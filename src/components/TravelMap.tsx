"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import maplibregl, { Map as MlMap, MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LocationItem } from "@/lib/types";
import { cleanThumb } from "@/lib/thumb";
import { countryFlagAccent } from "@/lib/countryFlagColors";
import type { MapTheme } from "@/lib/settings";

export type MapOverlayMode = "wishes" | "deals";

/** Deal fare data for the deals overlay. Keyed by country ISO code. */
export interface CountryDeal {
  countryCode: string;
  cheapestPrice: number;
  tier: "cheap" | "fair" | "splurge";
}

/** Journal country data for highlighting countries with memories. */
export interface JournalCountry {
  country: string;           // country name (e.g. "Japan")
  countryCode?: string;      // ISO-3 code if available
  entryCount: number;
  lat: number | null;
  lon: number | null;
}

/** Flight route for arc rendering on the map. */
export interface DealRoute {
  origin: string;
  destination: string;
  destCity: string;
  price: number;
  dealScore: number | null;
  tier: string | null;
  originLat: number;
  originLon: number;
  destLat: number;
  destLon: number;
}

const DEAL_TIER_COLORS: Record<string, string> = {
  cheap: "#2dd4bf",   // teal
  fair: "#f59e0b",    // amber
  splurge: "#fb7185", // coral
};

export interface FocusPoint {
  lng: number;
  lat: number;
  dimCountry?: string;
  nonce: number;
}

export interface TravelMapHandle {
  resetWorldView: () => void;
}

interface TravelMapProps {
  locations: LocationItem[];
  pinDropMode: boolean;
  focusPoint: FocusPoint | null;
  mapTheme: MapTheme;
  overlayMode?: MapOverlayMode;
  countryDeals?: CountryDeal[];
  journalCountries?: JournalCountry[];
  dealRoutes?: DealRoute[];
  onCountryClick: (code: string, name: string) => void;
  onDotClick: (id: string) => void;
  onPinDrop: (lat: number, lng: number) => void;
  onZoomStateChange?: (zoomedIn: boolean) => void;
}

type GeoFeature = {
  type: "Feature";
  id: string;
  properties: { name: string; count?: number; iso?: string; accent?: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
};

/** Hand-tuned zoom targets where the polygon bbox is misleading. */
const CUSTOM_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  // Contiguous 48 only — Alaska/Hawaii would otherwise stretch the view across half the planet
  USA: [
    [-124.85, 24.4],
    [-66.9, 49.4],
  ],
};

/** Alaska & Hawaii get their own fit targets when the click lands there. */
const USA_SUBREGIONS: {
  test: (lng: number, lat: number) => boolean;
  bounds: [[number, number], [number, number]];
}[] = [
  {
    test: (lng, lat) => lat > 50.5 && lng < -129,
    bounds: [
      [-171, 51.2],
      [-129.9, 71.5],
    ],
  },
  {
    test: (lng, lat) => lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154,
    bounds: [
      [-160.3, 18.9],
      [-154.7, 22.3],
    ],
  },
];

function countryBounds(feature: GeoFeature): [[number, number], [number, number]] {
  const custom = CUSTOM_BOUNDS[feature.id];
  if (custom) return custom;

  const lngs: number[] = [];
  const lats: number[] = [];
  const eat = (ring: number[][]) => {
    for (const [lng, lat] of ring) {
      lngs.push(lng);
      lats.push(lat);
    }
  };
  if (feature.geometry.type === "Polygon") {
    (feature.geometry.coordinates as number[][][]).forEach(eat);
  } else {
    (feature.geometry.coordinates as number[][][][]).forEach((poly) => poly.forEach(eat));
  }
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);
  // Antimeridian-spanning countries (Russia, Fiji): recompute in 0..360 space
  if (maxLng - minLng > 180) {
    const shifted = lngs.map((l) => (l < 0 ? l + 360 : l));
    minLng = Math.min(...shifted);
    maxLng = Math.max(...shifted);
    if (minLng > 180) minLng -= 360;
    if (maxLng > 180) maxLng -= 360;
    if (maxLng < minLng) maxLng += 360;
  }
  return [
    [minLng, Math.min(...lats)],
    [maxLng, Math.max(...lats)],
  ];
}

/** Pick zoom bounds based on where within a country the user clicked. */
function countryBoundsForClick(
  feature: GeoFeature,
  lng: number,
  lat: number
): [[number, number], [number, number]] {
  if (feature.id === "USA") {
    for (const region of USA_SUBREGIONS) {
      if (region.test(lng, lat)) return region.bounds;
    }
    return CUSTOM_BOUNDS.USA;
  }
  return countryBounds(feature);
}

function dotsGeoJson(locations: LocationItem[]) {
  return {
    type: "FeatureCollection" as const,
    features: locations.map((l) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [l.longitude, l.latitude] },
      properties: {
        id: l.id,
        status: l.status,
        isDeal: l.isDeal,
        name: l.activityName,
        coverImageUrl: l.coverImageUrl ?? "",
      },
    })),
  };
}

function countryCounts(locations: LocationItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const l of locations) counts[l.countryCode] = (counts[l.countryCode] ?? 0) + 1;
  return counts;
}

/** fill/line opacity are multiplied by the per-country "dim" feature-state (1 = normal). */
const DIM_FACTOR = ["coalesce", ["feature-state", "dim"], 1];
const DIMMED_VALUE = 0.15; // selected-country glow drops to 15%

/** Restore the glow once the user zooms out well past the country-fit zoom (capped at world view). */
function restoreThreshold(fitZoom: number): number {
  return Math.min(3, Math.max(1.2, fitZoom - 1.2));
}

/** Below this zoom the map is treated as world view (panel closes, world button hides). */
const WORLD_VIEW_ZOOM = 2.5;

function fillOpacityExpr(maxCount: number) {
  return [
    "*",
    ["interpolate", ["linear"], ["get", "count"], 0, 0, 1, 0.2, maxCount, 0.55],
    DIM_FACTOR,
  ] as unknown as number;
}

function fillColorExpr(maxCount: number, theme: MapTheme) {
  if (theme === "flag") {
    return ["coalesce", ["get", "accent"], "#fbbf24"] as unknown as string;
  }
  return [
    "interpolate",
    ["linear"],
    ["get", "count"],
    1, "#fbbf24",
    maxCount, "#f97316",
  ] as unknown as string;
}

function glowLineColorExpr(theme: MapTheme) {
  if (theme === "flag") {
    return ["coalesce", ["get", "accent"], "#fbbf24"] as unknown as string;
  }
  return "#fbbf24";
}

function applyHeatmapTheme(map: MlMap, theme: MapTheme, maxCount: number) {
  if (!map.getLayer(FILL_LAYER)) return;
  map.setPaintProperty(FILL_LAYER, "fill-color", fillColorExpr(maxCount, theme));
  map.setPaintProperty(FILL_LAYER, "fill-opacity", fillOpacityExpr(maxCount));
  map.setPaintProperty(GLOW_LINE_LAYER, "line-color", glowLineColorExpr(theme));
  map.setPaintProperty(GLOW_LINE_LAYER, "line-width", [
    "interpolate",
    ["linear"],
    ["zoom"],
    1,
    ["interpolate", ["linear"], ["get", "count"], 1, 1, maxCount, 2],
    8,
    ["interpolate", ["linear"], ["get", "count"], 1, 2, maxCount, 4],
    14,
    ["interpolate", ["linear"], ["get", "count"], 1, 3, maxCount, 6],
  ]);
}

function accentGlowWidthExpr(): unknown {
  return ["interpolate", ["linear"], ["zoom"], 1, 1.5, 3, 2.5, 6, 4.5, 10, 7, 14, 11];
}

function accentGlowBlurExpr(): unknown {
  return ["interpolate", ["linear"], ["zoom"], 1, 2, 6, 4.5, 10, 7, 14, 10];
}

function accentGlowOpacityExpr(): unknown {
  return [
    "case",
    ["boolean", ["feature-state", "selected"], false],
    0.95,
    ["boolean", ["feature-state", "hover"], false],
    0.72,
    0,
  ];
}
const FILL_LAYER = "country-fill";
const GLOW_LINE_LAYER = "country-glow-line";
const ACCENT_GLOW_LAYER = "country-accent-glow";
const BORDER_LAYER = "country-border";
const DOTS_GLOW = "dots-glow";
const DOTS_CORE = "dots-core";
const DOTS_DEAL = "dots-deal";
const JOURNAL_FILL_LAYER = "journal-country-fill";
const JOURNAL_GLOW_LAYER = "journal-country-glow";
const JOURNAL_BADGE_LAYER = "journal-badge";
const DEAL_ARC_LAYER = "deal-arcs";
const DEAL_ARC_GLOW_LAYER = "deal-arcs-glow";
const DEAL_ARC_ARROW_LAYER = "deal-arc-arrows";
const DEAL_DOT_GLOW_LAYER = "deal-dot-glow";
const DEAL_PRICE_LABEL = "deal-price-labels";
const COMBO_PULSE_LAYER = "combo-pulse";

/** Generate great-circle arc points between two coordinates. */
function greatCircleArc(
  lon1: number, lat1: number,
  lon2: number, lat2: number,
  steps = 48,
): [number, number][] {
  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;
  const φ1 = lat1 * DEG2RAD, λ1 = lon1 * DEG2RAD;
  const φ2 = lat2 * DEG2RAD, λ2 = lon2 * DEG2RAD;
  const x1 = Math.cos(φ1) * Math.cos(λ1), y1 = Math.cos(φ1) * Math.sin(λ1), z1 = Math.sin(φ1);
  const x2 = Math.cos(φ2) * Math.cos(λ2), y2 = Math.cos(φ2) * Math.sin(λ2), z2 = Math.sin(φ2);
  const dot = Math.min(1, Math.max(-1, x1 * x2 + y1 * y2 + z1 * z2));
  const ω = Math.acos(dot);
  const sinω = Math.sin(ω);
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let xi: number, yi: number, zi: number;
    if (sinω < 1e-9) { xi = x1; yi = y1; zi = z1; }
    else {
      const A = Math.sin((1 - t) * ω) / sinω;
      const B = Math.sin(t * ω) / sinω;
      xi = A * x1 + B * x2; yi = A * y1 + B * y2; zi = A * z1 + B * z2;
    }
    const lat = Math.atan2(zi, Math.sqrt(xi * xi + yi * yi)) * RAD2DEG;
    const lon = Math.atan2(yi, xi) * RAD2DEG;
    pts.push([lon, lat]);
  }
  return pts;
}

/** Build GeoJSON for deal flight arcs. */
function dealArcsGeoJson(routes: DealRoute[]) {
  return {
    type: "FeatureCollection" as const,
    features: routes.map((r, i) => ({
      type: "Feature" as const,
      properties: {
        id: `${r.origin}-${r.destination}`,
        price: r.price,
        tier: r.tier ?? "fair",
        destCity: r.destCity,
        dealScore: r.dealScore ?? 0,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: greatCircleArc(r.originLon, r.originLat, r.destLon, r.destLat),
      },
    })),
  };
}

/** Build GeoJSON for deal destination endpoint dots (for price labels). */
function dealEndpointsGeoJson(routes: DealRoute[]) {
  return {
    type: "FeatureCollection" as const,
    features: routes.map((r) => ({
      type: "Feature" as const,
      properties: {
        id: `${r.origin}-${r.destination}`,
        price: r.price,
        tier: r.tier ?? "fair",
        destCity: r.destCity,
        label: `$${r.price}`,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [r.destLon, r.destLat],
      },
    })),
  };
}

/** True when both the left (1) and right (2) mouse buttons are held. */
function bothMouseButtons(e: MouseEvent): boolean {
  return (e.buttons & 1) !== 0 && (e.buttons & 2) !== 0;
}

/**
 * Replace MapLibre's default right-click / Ctrl+drag rotation with a dual-button gesture:
 * hold left AND right while dragging to rotate. Right-click alone does nothing.
 */
function attachDualButtonRotate(map: MlMap): () => void {
  map.dragRotate.disable();

  const canvas = map.getCanvas();
  let rotating = false;
  let lastX = 0;
  let panSuspended = false;

  const suspendPan = () => {
    if (!panSuspended && map.dragPan.isEnabled()) {
      map.dragPan.disable();
      panSuspended = true;
    }
  };

  const resumePan = () => {
    if (panSuspended) {
      map.dragPan.enable();
      panSuspended = false;
    }
    rotating = false;
  };

  const onMove = (e: MouseEvent) => {
    if (!bothMouseButtons(e)) {
      resumePan();
      return;
    }
    suspendPan();
    if (!rotating) {
      rotating = true;
      lastX = e.clientX;
      return;
    }
    map.setBearing(map.getBearing() + (e.clientX - lastX) * 0.8);
    lastX = e.clientX;
  };

  const onContextMenu = (e: MouseEvent) => e.preventDefault();

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", resumePan);
  canvas.addEventListener("contextmenu", onContextMenu);

  return () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", resumePan);
    canvas.removeEventListener("contextmenu", onContextMenu);
    resumePan();
  };
}

export default forwardRef<TravelMapHandle, TravelMapProps>(function TravelMap(
  {
    locations,
    pinDropMode,
    focusPoint,
    mapTheme,
    overlayMode = "wishes",
    countryDeals = [],
    journalCountries = [],
    dealRoutes = [],
    onCountryClick,
    onDotClick,
    onPinDrop,
    onZoomStateChange,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const loadedRef = useRef(false);
  const countriesRef = useRef<GeoFeature[]>([]);
  const locationsRef = useRef(locations);
  const pinDropRef = useRef(pinDropMode);
  const overlayModeRef = useRef(overlayMode);
  const countryDealsRef = useRef(countryDeals);
  const journalCountriesRef = useRef(journalCountries);
  const dealRoutesRef = useRef(dealRoutes);
  const callbacksRef = useRef({ onCountryClick, onDotClick, onPinDrop, onZoomStateChange });
  const pulseRafRef = useRef<number>(0);
  const selectedIsoRef = useRef<string | null>(null);
  const hoveredIsoRef = useRef<string | null>(null);
  const restoreBelowZoomRef = useRef(1.2);
  const dimValuesRef = useRef<Record<string, number>>({});
  const dimRafsRef = useRef<Record<string, number>>({});
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    name: string;
    cover?: string;
  } | null>(null);

  const mapThemeRef = useRef(mapTheme);
  mapThemeRef.current = mapTheme;
  pinDropRef.current = pinDropMode;
  overlayModeRef.current = overlayMode;
  countryDealsRef.current = countryDeals;
  journalCountriesRef.current = journalCountries;
  dealRoutesRef.current = dealRoutes;
  callbacksRef.current = { onCountryClick, onDotClick, onPinDrop, onZoomStateChange };

  const hideHover = () => setHover(null);

  const setCountryHover = (iso: string | null) => {
    const map = mapRef.current;
    if (!map || !map.getSource("countries")) return;
    const prev = hoveredIsoRef.current;
    if (prev === iso) return;
    if (prev) map.removeFeatureState({ source: "countries", id: prev }, "hover");
    if (iso) map.setFeatureState({ source: "countries", id: iso }, { hover: true });
    hoveredIsoRef.current = iso;
  };

  const setCountrySelectedAccent = (iso: string | null) => {
    const map = mapRef.current;
    if (!map || !map.getSource("countries")) return;
    const prev = selectedIsoRef.current;
    if (prev && prev !== iso) {
      map.removeFeatureState({ source: "countries", id: prev }, "selected");
    }
    if (iso) {
      map.setFeatureState({ source: "countries", id: iso }, { selected: true });
    } else if (prev) {
      map.removeFeatureState({ source: "countries", id: prev }, "selected");
    }
  };

  const tweenDim = (iso: string, target: number) => {
    const map = mapRef.current;
    if (!map || !map.getSource("countries")) return;
    cancelAnimationFrame(dimRafsRef.current[iso]);
    const from = dimValuesRef.current[iso] ?? 1;
    const start = performance.now();
    const duration = 650;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const eased = k * (2 - k); // ease-out
      const value = from + (target - from) * eased;
      dimValuesRef.current[iso] = value;
      map.setFeatureState({ source: "countries", id: iso }, { dim: value });
      if (k < 1) dimRafsRef.current[iso] = requestAnimationFrame(step);
    };
    dimRafsRef.current[iso] = requestAnimationFrame(step);
  };

  // Initialize the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          carto: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          },
        },
        layers: [{ id: "carto", type: "raster", source: "carto" }],
      },
      center: [20, 22],
      zoom: 1.6,
      minZoom: 1,
      maxZoom: 17,
      dragRotate: false,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    const detachDualRotate = attachDualButtonRotate(map);
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __map?: MlMap }).__map = map;
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", async () => {
      const res = await fetch("/data/countries.geo.json");
      const geo = await res.json();
      countriesRef.current = geo.features as GeoFeature[];

      const counts = countryCounts(locationsRef.current);
      for (const f of countriesRef.current) {
        f.properties.count = counts[f.id] ?? 0;
        f.properties.iso = f.id;
        (f.properties as { accent?: string }).accent = countryFlagAccent(f.id);
      }
      const maxCount = Math.max(2, ...Object.values(counts));

      // promoteId lets us use the string ISO code with setFeatureState for the dim effect
      map.addSource("countries", { type: "geojson", data: geo, promoteId: "iso" });
      map.addLayer({
        id: FILL_LAYER,
        type: "fill",
        source: "countries",
        paint: {
          "fill-color": fillColorExpr(maxCount, mapThemeRef.current),
          "fill-opacity": fillOpacityExpr(maxCount),
        },
      });
      map.addLayer({
        id: BORDER_LAYER,
        type: "line",
        source: "countries",
        paint: { "line-color": "rgba(148,163,184,0.18)", "line-width": 0.6 },
      });
      map.addLayer({
        id: GLOW_LINE_LAYER,
        type: "line",
        source: "countries",
        filter: [">", ["get", "count"], 0],
        paint: {
          "line-color": glowLineColorExpr(mapThemeRef.current),
          "line-opacity": ["*", 0.85, DIM_FACTOR] as unknown as number,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1,
            ["interpolate", ["linear"], ["get", "count"], 1, 1, maxCount, 2],
            8,
            ["interpolate", ["linear"], ["get", "count"], 1, 2, maxCount, 4],
            14,
            ["interpolate", ["linear"], ["get", "count"], 1, 3, maxCount, 6],
          ] as unknown as number,
          "line-blur": ["interpolate", ["linear"], ["zoom"], 1, 2, 8, 4, 14, 6] as unknown as number,
        },
      });
      map.addLayer({
        id: ACCENT_GLOW_LAYER,
        type: "line",
        source: "countries",
        paint: {
          "line-color": ["coalesce", ["get", "accent"], "#fbbf24"],
          "line-opacity": accentGlowOpacityExpr() as number,
          "line-width": accentGlowWidthExpr() as number,
          "line-blur": accentGlowBlurExpr() as number,
        },
      });

      map.addSource("dots", { type: "geojson", data: dotsGeoJson(locationsRef.current) });
      map.addLayer({
        id: DOTS_GLOW,
        type: "circle",
        source: "dots",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 7, 8, 16, 14, 26],
          "circle-color": ["match", ["get", "status"], "VISITED", "#34d399", "#fbbf24"],
          "circle-blur": 1,
          "circle-opacity": 0.55,
        },
      });
      map.addLayer({
        id: DOTS_CORE,
        type: "circle",
        source: "dots",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 3, 8, 5.5, 14, 8],
          "circle-color": ["match", ["get", "status"], "VISITED", "#34d399", "#fbbf24"],
          "circle-stroke-color": "rgba(255,255,255,0.9)",
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: DOTS_DEAL,
        type: "circle",
        source: "dots",
        filter: ["==", ["get", "isDeal"], true],
        paint: {
          "circle-radius": 10,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#fb7185",
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0.9,
        },
      });

      // ── Journal country highlighting ──
      // We add a separate source for journal-highlighted countries using the same GeoJSON
      // but with journal-specific properties. This overlays on top of the base country layer.
      map.addSource("journal-countries", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        promoteId: "iso",
      });

      // Soft purple/violet fill for countries with journal entries
      map.addLayer({
        id: JOURNAL_FILL_LAYER,
        type: "fill",
        source: "journal-countries",
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["get", "hasCombo"], false],
            "#f59e0b", // gold for journal + deal combo
            "#a78bfa", // violet for journal-only
          ] as unknown as string,
          "fill-opacity": [
            "interpolate", ["linear"], ["get", "entryCount"],
            1, 0.12,
            5, 0.22,
            15, 0.32,
          ] as unknown as number,
        },
      });

      // Glowing border for journal countries
      map.addLayer({
        id: JOURNAL_GLOW_LAYER,
        type: "line",
        source: "journal-countries",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["get", "hasCombo"], false],
            "#fbbf24", // gold glow for combo
            "#c4b5fd", // light violet glow for journal
          ] as unknown as string,
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            1, 1.5,
            6, 3,
            14, 5,
          ] as unknown as number,
          "line-blur": [
            "interpolate", ["linear"], ["zoom"],
            1, 2,
            6, 4,
            14, 6,
          ] as unknown as number,
          "line-opacity": [
            "case",
            ["boolean", ["get", "hasCombo"], false],
            0.85,
            0.6,
          ] as unknown as number,
        },
      });

      // Pulsing highlight for combo countries (journal + deal)
      map.addLayer({
        id: COMBO_PULSE_LAYER,
        type: "line",
        source: "journal-countries",
        filter: ["==", ["get", "hasCombo"], true],
        paint: {
          "line-color": "#fbbf24",
          "line-width": 4,
          "line-blur": 8,
          "line-opacity": 0.7,
        },
      });

      // ── Flight deal arc paths ──
      map.addSource("deal-arcs", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addSource("deal-endpoints", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Glow under the arc
      map.addLayer({
        id: DEAL_ARC_GLOW_LAYER,
        type: "line",
        source: "deal-arcs",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "tier"], "cheap"], "#2dd4bf",
            ["==", ["get", "tier"], "fair"], "#f59e0b",
            "#fb7185",
          ] as unknown as string,
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            1, 3,
            6, 6,
            14, 10,
          ] as unknown as number,
          "line-blur": [
            "interpolate", ["linear"], ["zoom"],
            1, 4,
            6, 8,
            14, 12,
          ] as unknown as number,
          "line-opacity": 0.3,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: "none",
        },
      });

      // Main arc line
      map.addLayer({
        id: DEAL_ARC_LAYER,
        type: "line",
        source: "deal-arcs",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "tier"], "cheap"], "#2dd4bf",
            ["==", ["get", "tier"], "fair"], "#f59e0b",
            "#fb7185",
          ] as unknown as string,
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            1, 1.2,
            6, 2,
            14, 3,
          ] as unknown as number,
          "line-opacity": 0.75,
          "line-dasharray": [2, 3],
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: "none",
        },
      });

      // Price label dots at destinations
      map.addLayer({
        id: DEAL_ARC_ARROW_LAYER,
        type: "circle",
        source: "deal-endpoints",
        layout: {
          visibility: "none",
        },
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            1, 4,
            6, 7,
            14, 10,
          ] as unknown as number,
          "circle-color": [
            "case",
            ["==", ["get", "tier"], "cheap"], "#2dd4bf",
            ["==", ["get", "tier"], "fair"], "#f59e0b",
            "#fb7185",
          ] as unknown as string,
          "circle-stroke-color": "#0f172a",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.9,
        },
      });

      // Glow under airport deal dots
      map.addLayer({
        id: DEAL_DOT_GLOW_LAYER,
        type: "circle",
        source: "deal-endpoints",
        layout: {
          visibility: "none",
        },
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            1, 10,
            6, 16,
            14, 22,
          ] as unknown as number,
          "circle-color": [
            "case",
            ["==", ["get", "tier"], "cheap"], "#2dd4bf",
            ["==", ["get", "tier"], "fair"], "#f59e0b",
            "#fb7185",
          ] as unknown as string,
          "circle-blur": 1,
          "circle-opacity": 0.4,
        },
      });

      // Price labels at deal airport dots
      map.addLayer({
        id: DEAL_PRICE_LABEL,
        type: "symbol",
        source: "deal-endpoints",
        layout: {
          "text-field": ["get", "label"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 3, 9, 6, 11, 10, 13] as unknown as number,
          "text-offset": [0, 1.5],
          "text-anchor": "top",
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          visibility: "none",
        },
        paint: {
          "text-color": "#e2e8f0",
          "text-halo-color": "#0f172a",
          "text-halo-width": 1.5,
        },
        minzoom: 3,
      });

      // Pulse animation for flight-deal rings + combo country glow
      const start = performance.now();
      const pulse = (now: number) => {
        const t = ((now - start) % 1600) / 1600;
        if (map.getLayer(DOTS_DEAL)) {
          map.setPaintProperty(DOTS_DEAL, "circle-radius", 9 + 7 * t);
          map.setPaintProperty(DOTS_DEAL, "circle-stroke-opacity", 0.9 * (1 - t));
        }
        // Combo countries get a slow breathing glow
        const comboT = ((now - start) % 3000) / 3000;
        const comboOpacity = 0.3 + 0.5 * Math.sin(comboT * Math.PI * 2);
        if (map.getLayer(COMBO_PULSE_LAYER)) {
          map.setPaintProperty(COMBO_PULSE_LAYER, "line-opacity", comboOpacity);
        }
        pulseRafRef.current = requestAnimationFrame(pulse);
      };
      pulseRafRef.current = requestAnimationFrame(pulse);

      loadedRef.current = true;

      map.on("click", (e: MapMouseEvent) => {
        if (pinDropRef.current) {
          callbacksRef.current.onPinDrop(e.lngLat.lat, e.lngLat.lng);
          return;
        }
        // Check for deal airport dot clicks first (in deals mode)
        if (overlayModeRef.current === "deals" && map.getLayer(DEAL_ARC_ARROW_LAYER)) {
          const dealDots = map.queryRenderedFeatures(e.point, { layers: [DEAL_ARC_ARROW_LAYER] });
          if (dealDots.length > 0) {
            const props = dealDots[0].properties;
            callbacksRef.current.onDotClick(props.id as string);
            return;
          }
        }
        const dots = map.queryRenderedFeatures(e.point, { layers: [DOTS_CORE, DOTS_GLOW] });
        if (dots.length > 0) {
          callbacksRef.current.onDotClick(dots[0].properties.id as string);
          return;
        }
        const countries = map.queryRenderedFeatures(e.point, { layers: [FILL_LAYER] });
        if (countries.length > 0) {
          const props = countries[0].properties as { iso: string; name: string; count: number };
          const feature = countriesRef.current.find((f) => f.id === props.iso);
          let fitZoom = map.getZoom();
          if (feature) {
            const bounds = countryBoundsForClick(feature, e.lngLat.lng, e.lngLat.lat);
            const camera = map.cameraForBounds(bounds, { padding: 80, maxZoom: 7 });
            fitZoom = camera?.zoom ?? fitZoom;
            map.fitBounds(bounds, { padding: 80, duration: 1100, maxZoom: 7 });
          }
          // Fade the clicked country's heatmap glow so individual dots stand out
          const previous = selectedIsoRef.current;
          if (previous && previous !== props.iso) tweenDim(previous, 1);
          setCountrySelectedAccent(props.iso);
          selectedIsoRef.current = props.iso;
          restoreBelowZoomRef.current = restoreThreshold(fitZoom);
          if (props.count > 0) {
            tweenDim(props.iso, DIMMED_VALUE);
            callbacksRef.current.onCountryClick(props.iso, props.name);
            callbacksRef.current.onZoomStateChange?.(true);
          } else {
            callbacksRef.current.onZoomStateChange?.(true);
          }
        }
      });

      // Restore country glow + world-view UI when zoomed out
      map.on("zoomend", () => {
        const z = map.getZoom();
        if (selectedIsoRef.current && z < restoreBelowZoomRef.current) {
          tweenDim(selectedIsoRef.current, 1);
          setCountrySelectedAccent(null);
          selectedIsoRef.current = null;
        }
        if (z < WORLD_VIEW_ZOOM) {
          callbacksRef.current.onZoomStateChange?.(false);
        }
      });

      map.on("mousemove", (e: MapMouseEvent) => {
        if (pinDropRef.current) {
          map.getCanvas().style.cursor = "crosshair";
          setCountryHover(null);
          hideHover();
          return;
        }
        // Check deal endpoint dots first (in deals mode)
        if (overlayModeRef.current === "deals" && map.getLayer(DEAL_ARC_ARROW_LAYER)) {
          const dealDotHit = map.queryRenderedFeatures(e.point, { layers: [DEAL_ARC_ARROW_LAYER] });
          if (dealDotHit.length > 0) {
            const p = dealDotHit[0].properties;
            setHover({
              x: e.point.x + 14,
              y: e.point.y + 14,
              name: `${p.destCity} — $${p.price}`,
            });
            map.getCanvas().style.cursor = "pointer";
            setCountryHover(null);
            return;
          }
        }

        const hits = map.queryRenderedFeatures(e.point, { layers: [DOTS_CORE, DOTS_GLOW, FILL_LAYER] });
        const dotHit = hits.find((h) => h.layer.id !== FILL_LAYER);
        const countryHit = hits.find((h) => h.layer.id === FILL_LAYER);
        const countryIso = countryHit ? (countryHit.properties.iso as string) : null;
        setCountryHover(dotHit ? null : countryIso);
        const interactive = Boolean(dotHit) || Boolean(countryHit);
        map.getCanvas().style.cursor = interactive ? "pointer" : "";

        if (dotHit) {
          const cover = dotHit.properties.coverImageUrl as string;
          setHover({
            x: e.point.x + 14,
            y: e.point.y + 14,
            name: dotHit.properties.name as string,
            cover: cleanThumb(cover) || undefined,
          });
        } else if (countryHit) {
          const props = countryHit.properties as { name: string; count: number; hasDeal?: number; dealPrice?: number };
          const isDeals = overlayModeRef.current === "deals";
          let label: string;
          if (isDeals && props.hasDeal && props.dealPrice) {
            label = `${props.name} — $${props.dealPrice}`;
          } else {
            label = props.count > 0 ? `${props.name} - ${props.count}` : props.name;
          }
          setHover({
            x: e.point.x + 14,
            y: e.point.y + 14,
            name: label,
          });
        } else {
          hideHover();
        }
      });

      map.on("mouseout", () => {
        setCountryHover(null);
        hideHover();
      });
      map.on("movestart", () => {
        setCountryHover(null);
        hideHover();
      });
    });

    return () => {
      detachDualRotate();
      cancelAnimationFrame(pulseRafRef.current);
      Object.values(dimRafsRef.current).forEach(cancelAnimationFrame);
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep sources in sync when locations change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    const dotsSource = map.getSource("dots") as maplibregl.GeoJSONSource | undefined;
    dotsSource?.setData(dotsGeoJson(locations));

    const counts = countryCounts(locations);
    for (const f of countriesRef.current) {
      f.properties.count = counts[f.id] ?? 0;
      f.properties.accent = countryFlagAccent(f.id);
    }
    const countriesSource = map.getSource("countries") as maplibregl.GeoJSONSource | undefined;
    countriesSource?.setData({ type: "FeatureCollection", features: countriesRef.current } as GeoJSON.GeoJSON);

    const maxCount = Math.max(2, ...Object.values(counts), 0);
    applyHeatmapTheme(map, mapTheme, maxCount);
  }, [locations, mapTheme]);

  // Toggle between Wishes and Deals overlay modes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    if (overlayMode === "deals") {
      // Build a lookup of deal colors by ISO code
      const dealsByCountry = new Map<string, CountryDeal>();
      for (const d of countryDeals) {
        dealsByCountry.set(d.countryCode, d);
      }

      // Update country properties with deal data
      for (const f of countriesRef.current) {
        const deal = dealsByCountry.get(f.id);
        if (deal) {
          (f.properties as Record<string, unknown>).dealTier = deal.tier;
          (f.properties as Record<string, unknown>).dealPrice = deal.cheapestPrice;
          (f.properties as Record<string, unknown>).hasDeal = 1;
        } else {
          (f.properties as Record<string, unknown>).dealTier = null;
          (f.properties as Record<string, unknown>).dealPrice = null;
          (f.properties as Record<string, unknown>).hasDeal = 0;
        }
      }

      const countriesSource = map.getSource("countries") as maplibregl.GeoJSONSource | undefined;
      countriesSource?.setData({ type: "FeatureCollection", features: countriesRef.current } as GeoJSON.GeoJSON);

      // Apply deal-based fill coloring
      if (map.getLayer(FILL_LAYER)) {
        map.setPaintProperty(FILL_LAYER, "fill-color", [
          "case",
          ["==", ["get", "dealTier"], "cheap"], DEAL_TIER_COLORS.cheap,
          ["==", ["get", "dealTier"], "fair"], DEAL_TIER_COLORS.fair,
          ["==", ["get", "dealTier"], "splurge"], DEAL_TIER_COLORS.splurge,
          "rgba(0,0,0,0)",
        ] as unknown as string);
        map.setPaintProperty(FILL_LAYER, "fill-opacity", [
          "case",
          [">", ["get", "hasDeal"], 0], 0.35,
          0,
        ] as unknown as number);
      }

      // Update glow line for deals
      if (map.getLayer(GLOW_LINE_LAYER)) {
        map.setFilter(GLOW_LINE_LAYER, [">", ["get", "hasDeal"], 0]);
        map.setPaintProperty(GLOW_LINE_LAYER, "line-color", [
          "case",
          ["==", ["get", "dealTier"], "cheap"], DEAL_TIER_COLORS.cheap,
          ["==", ["get", "dealTier"], "fair"], DEAL_TIER_COLORS.fair,
          ["==", ["get", "dealTier"], "splurge"], DEAL_TIER_COLORS.splurge,
          "#fbbf24",
        ] as unknown as string);
      }

      // Hide wish dots in deals mode
      if (map.getLayer(DOTS_GLOW)) map.setLayoutProperty(DOTS_GLOW, "visibility", "none");
      if (map.getLayer(DOTS_CORE)) map.setLayoutProperty(DOTS_CORE, "visibility", "none");
      if (map.getLayer(DOTS_DEAL)) map.setLayoutProperty(DOTS_DEAL, "visibility", "none");

      // Show deal airport dots and price labels
      if (map.getLayer(DEAL_ARC_ARROW_LAYER)) map.setLayoutProperty(DEAL_ARC_ARROW_LAYER, "visibility", "visible");
      if (map.getLayer(DEAL_DOT_GLOW_LAYER)) map.setLayoutProperty(DEAL_DOT_GLOW_LAYER, "visibility", "visible");
      if (map.getLayer(DEAL_PRICE_LABEL)) map.setLayoutProperty(DEAL_PRICE_LABEL, "visibility", "visible");

    } else {
      // Restore wishes mode: re-apply heatmap and show dots
      const counts = countryCounts(locations);
      for (const f of countriesRef.current) {
        f.properties.count = counts[f.id] ?? 0;
      }
      const countriesSource = map.getSource("countries") as maplibregl.GeoJSONSource | undefined;
      countriesSource?.setData({ type: "FeatureCollection", features: countriesRef.current } as GeoJSON.GeoJSON);

      const maxCount = Math.max(2, ...Object.values(counts), 0);
      applyHeatmapTheme(map, mapTheme, maxCount);

      // Restore glow line filter
      if (map.getLayer(GLOW_LINE_LAYER)) {
        map.setFilter(GLOW_LINE_LAYER, [">", ["get", "count"], 0]);
      }

      // Show wish dots
      if (map.getLayer(DOTS_GLOW)) map.setLayoutProperty(DOTS_GLOW, "visibility", "visible");
      if (map.getLayer(DOTS_CORE)) map.setLayoutProperty(DOTS_CORE, "visibility", "visible");
      if (map.getLayer(DOTS_DEAL)) map.setLayoutProperty(DOTS_DEAL, "visibility", "visible");

      // Hide deal airport dots and price labels
      if (map.getLayer(DEAL_ARC_ARROW_LAYER)) map.setLayoutProperty(DEAL_ARC_ARROW_LAYER, "visibility", "none");
      if (map.getLayer(DEAL_DOT_GLOW_LAYER)) map.setLayoutProperty(DEAL_DOT_GLOW_LAYER, "visibility", "none");
      if (map.getLayer(DEAL_PRICE_LABEL)) map.setLayoutProperty(DEAL_PRICE_LABEL, "visibility", "none");
    }
  }, [overlayMode, countryDeals, locations, mapTheme]);

  // Update journal country highlighting when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    const journalSource = map.getSource("journal-countries") as maplibregl.GeoJSONSource | undefined;
    if (!journalSource) return;

    // Build a set of deal country codes for combo detection
    const dealCountryCodes = new Set(countryDealsRef.current.map((d) => d.countryCode));

    // Match journal country names to GeoJSON features by name
    const journalByName = new Map<string, JournalCountry>();
    for (const jc of journalCountries) {
      journalByName.set(jc.country.toLowerCase(), jc);
    }

    const matchedFeatures: GeoFeature[] = [];
    for (const f of countriesRef.current) {
      const jc = journalByName.get(f.properties.name.toLowerCase());
      if (!jc) continue;
      const hasCombo = dealCountryCodes.has(f.id);
      matchedFeatures.push({
        ...f,
        properties: {
          ...f.properties,
          iso: f.id,
          entryCount: jc.entryCount,
          hasCombo,
        } as GeoFeature["properties"] & { entryCount: number; hasCombo: boolean },
      } as unknown as GeoFeature);
    }

    journalSource.setData({
      type: "FeatureCollection",
      features: matchedFeatures,
    } as GeoJSON.GeoJSON);
  }, [journalCountries, countryDeals]);

  // Update deal flight arc paths when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    const arcsSource = map.getSource("deal-arcs") as maplibregl.GeoJSONSource | undefined;
    const endpointsSource = map.getSource("deal-endpoints") as maplibregl.GeoJSONSource | undefined;

    if (arcsSource) {
      arcsSource.setData(dealArcsGeoJson(dealRoutes));
    }
    if (endpointsSource) {
      endpointsSource.setData(dealEndpointsGeoJson(dealRoutes));
    }

    // Show/hide arc layers based on overlay mode
    const visible = overlayMode === "deals" && dealRoutes.length > 0;
    const visibility = visible ? "visible" : "none";
    for (const layerId of [DEAL_ARC_LAYER, DEAL_ARC_GLOW_LAYER, DEAL_ARC_ARROW_LAYER, DEAL_DOT_GLOW_LAYER, DEAL_PRICE_LABEL]) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visibility);
      }
    }
  }, [dealRoutes, overlayMode]);

  // Fly to a wish selected in the sidebar
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusPoint) return;
    const targetZoom = Math.max(map.getZoom(), 5.5);
    map.flyTo({
      center: [focusPoint.lng, focusPoint.lat],
      zoom: targetZoom,
      duration: 1400,
    });
    if (focusPoint.dimCountry) {
      const previous = selectedIsoRef.current;
      if (previous && previous !== focusPoint.dimCountry) tweenDim(previous, 1);
      setCountrySelectedAccent(focusPoint.dimCountry);
      selectedIsoRef.current = focusPoint.dimCountry;
      restoreBelowZoomRef.current = restoreThreshold(targetZoom);
      tweenDim(focusPoint.dimCountry, DIMMED_VALUE);
    }
    callbacksRef.current.onZoomStateChange?.(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPoint]);

  useImperativeHandle(ref, () => ({
    resetWorldView: () => {
      const map = mapRef.current;
      if (!map) return;
      if (selectedIsoRef.current) {
        tweenDim(selectedIsoRef.current, 1);
        setCountrySelectedAccent(null);
        selectedIsoRef.current = null;
      }
      map.flyTo({ center: [20, 22], zoom: 1.6, duration: 1100 });
      callbacksRef.current.onZoomStateChange?.(false);
    },
  }));

  // Pin-drop cursor when entering/leaving the mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = pinDropMode ? "crosshair" : "";
    if (pinDropMode) hideHover();
  }, [pinDropMode]);

  return (
    <div className="absolute inset-0 h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-[200px] overflow-hidden rounded-lg border border-slate-700 bg-slate-900/95 shadow-xl"
          style={{ left: hover.x, top: hover.y }}
        >
          {hover.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hover.cover} alt="" className="h-24 w-full object-cover" />
          )}
          <p className="px-2 py-1.5 text-xs font-medium text-slate-100">{hover.name}</p>
        </div>
      )}
    </div>
  );
});
