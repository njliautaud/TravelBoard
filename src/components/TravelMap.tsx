"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import maplibregl, { Map as MlMap, MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LocationItem, StatusFilter } from "@/lib/types";
import { matchesStatusFilter } from "@/lib/types";
import { coverImageSrc } from "@/lib/thumb";
import { countryFlagAccent } from "@/lib/countryFlagColors";
import { countByUnit } from "@/lib/geoUnits";
import type { UsStateFeature } from "@/lib/usStates";
import type { MapTheme } from "@/lib/settings";

/** Country-level deal data for map heatmap overlay. */
export interface CountryDeal {
  countryCode: string;
  cheapestPrice: number;
  tier: "cheap" | "fair" | "splurge";
}

/** Journal country data for highlighting countries with memories. */
export interface JournalCountry {
  country: string;
  countryCode?: string;
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
  /** Map view filter: all wishes, only to-visit, or only visited. */
  statusFilter: StatusFilter;
  /** Treat each US state as its own map unit. */
  usaAsStates: boolean;
  /** US-state polygons (loaded by the parent); null until available. */
  states: UsStateFeature[] | null;
  /** Flight deal routes to render as arcs on the map. */
  dealRoutes?: DealRoute[];
  /** Key like "MCO-NRT" identifying the currently highlighted route. */
  activeDealRoute?: string | null;
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

/**
 * Padding (px) for fitBounds/flyTo so the target lands in the *visible* map area,
 * not under the SidePanel. The panel is a fixed overlay: 400px on the right on
 * desktop (sm+), a bottom sheet (~half the height) on mobile. The left sidebar is
 * part of the desktop flex layout (already excluded from the map box) so it needs
 * no compensation here.
 */
function visibleAreaPadding(panelOpen: boolean): number | maplibregl.PaddingOptions {
  const base = 60;
  if (!panelOpen || typeof window === "undefined") return base;
  const isDesktop = window.innerWidth >= 640;
  if (isDesktop) {
    return { top: base, bottom: base, left: base, right: base + 400 };
  }
  // Mobile bottom sheet: pad the bottom so the country sits above it.
  return { top: base, left: base, right: base, bottom: base + Math.round(window.innerHeight * 0.45) };
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

/** Country features minus USA, plus per-state features (when states mode is on). */
function statesToFeatures(states: UsStateFeature[]): GeoFeature[] {
  return states.map((s) => ({
    type: "Feature",
    id: s.id,
    properties: { name: s.properties.name },
    geometry: s.geometry as GeoFeature["geometry"],
  }));
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

// Deal route layer IDs
const DEAL_ROUTES_LINE = "deal-routes-line";
const DEAL_ROUTES_ACTIVE = "deal-routes-active";
const DEAL_AIRPORTS_ORIGIN = "deal-airports-origin";
const DEAL_AIRPORTS_DEST = "deal-airports-dest";
const DEAL_ROUTE_PRICES = "deal-route-prices";

/**
 * Generate intermediate points along a great circle arc between two coordinates.
 * This produces the curved flight-path look on the map.
 */
function generateArc(
  originLon: number,
  originLat: number,
  destLon: number,
  destLat: number,
  numPoints = 50
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const lat1 = toRad(originLat);
  const lon1 = toRad(originLon);
  const lat2 = toRad(destLat);
  const lon2 = toRad(destLon);

  const d = 2 * Math.asin(
    Math.sqrt(
      Math.sin((lat2 - lat1) / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
    )
  );

  if (d < 1e-10) return [[originLon, originLat], [destLon, destLat]];

  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const a = Math.sin((1 - f) * d) / Math.sin(d);
    const b = Math.sin(f * d) / Math.sin(d);
    const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
    const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lon = toDeg(Math.atan2(y, x));
    points.push([lon, lat]);
  }
  return points;
}

/** Build GeoJSON FeatureCollection for route arc lines. */
function routesGeoJson(routes: DealRoute[]) {
  return {
    type: "FeatureCollection" as const,
    features: routes.map((r) => ({
      type: "Feature" as const,
      properties: {
        key: `${r.origin}-${r.destination}`,
        price: r.price,
        tier: r.tier ?? "fair",
        origin: r.origin,
        destination: r.destination,
        destCity: r.destCity,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: generateArc(r.originLon, r.originLat, r.destLon, r.destLat, 50),
      },
    })),
  };
}

/** Build GeoJSON FeatureCollection for airport dots (origin + destination). */
function airportsGeoJson(routes: DealRoute[]) {
  const seen = new Map<string, { lon: number; lat: number; role: "origin" | "dest"; code: string }>();
  for (const r of routes) {
    if (!seen.has(`o-${r.origin}`)) {
      seen.set(`o-${r.origin}`, { lon: r.originLon, lat: r.originLat, role: "origin", code: r.origin });
    }
    if (!seen.has(`d-${r.destination}`)) {
      seen.set(`d-${r.destination}`, { lon: r.destLon, lat: r.destLat, role: "dest", code: r.destination });
    }
  }
  return {
    type: "FeatureCollection" as const,
    features: [...seen.values()].map((a) => ({
      type: "Feature" as const,
      properties: { code: a.code, role: a.role },
      geometry: { type: "Point" as const, coordinates: [a.lon, a.lat] },
    })),
  };
}

/** Build GeoJSON for price labels at arc midpoints. */
function routePricesGeoJson(routes: DealRoute[]) {
  return {
    type: "FeatureCollection" as const,
    features: routes.map((r) => {
      const mid = generateArc(r.originLon, r.originLat, r.destLon, r.destLat, 2)[1]!;
      return {
        type: "Feature" as const,
        properties: {
          key: `${r.origin}-${r.destination}`,
          label: `$${r.price}`,
        },
        geometry: { type: "Point" as const, coordinates: mid },
      };
    }),
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
    statusFilter,
    usaAsStates,
    states,
    dealRoutes = [],
    activeDealRoute = null,
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
  // The feature set actually rendered (countries, with USA swapped for its
  // states when "USA as states" is on). Used for click-to-fit bounds lookup.
  const displayFeaturesRef = useRef<GeoFeature[]>([]);
  const locationsRef = useRef(locations);
  const statusFilterRef = useRef(statusFilter);
  const usaAsStatesRef = useRef(usaAsStates);
  const statesRef = useRef(states);
  const pinDropRef = useRef(pinDropMode);
  const callbacksRef = useRef({ onCountryClick, onDotClick, onPinDrop, onZoomStateChange });
  const pulseRafRef = useRef<number>(0);
  const routePulseRafRef = useRef<number>(0);
  const dealRoutesRef = useRef(dealRoutes);
  const activeDealRouteRef = useRef(activeDealRoute);
  dealRoutesRef.current = dealRoutes;
  activeDealRouteRef.current = activeDealRoute;
  const selectedIsoRef = useRef<string | null>(null);
  const hoveredIsoRef = useRef<string | null>(null);
  const restoreBelowZoomRef = useRef(1.2);
  // When we deliberately fly/fit to a country or wish, its settled zoom can land
  // below WORLD_VIEW_ZOOM on small/portrait screens. Suppress the world-view
  // close for the duration of that animation so the panel stays open.
  const lastFocusAtRef = useRef(0);
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
  locationsRef.current = locations;
  statusFilterRef.current = statusFilter;
  usaAsStatesRef.current = usaAsStates;
  statesRef.current = states;
  pinDropRef.current = pinDropMode;
  callbacksRef.current = { onCountryClick, onDotClick, onPinDrop, onZoomStateChange };

  // Rebuild the country/state heatmap + dots from the current locations, status
  // filter, and states-mode setting. Single source of truth for all of them.
  const rebuildGeo = useCallback(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getSource("countries")) return;

    const usaAsStates = usaAsStatesRef.current;
    const states = statesRef.current;
    const filtered = locationsRef.current.filter((l) =>
      matchesStatusFilter(l.status, statusFilterRef.current),
    );

    const feats: GeoFeature[] =
      usaAsStates && states?.length
        ? [...countriesRef.current.filter((f) => f.id !== "USA"), ...statesToFeatures(states)]
        : countriesRef.current;

    const counts = countByUnit(filtered, { usaAsStates, states });
    for (const f of feats) {
      f.properties.count = counts[f.id] ?? 0;
      f.properties.iso = f.id;
      f.properties.accent = f.id.startsWith("US-")
        ? countryFlagAccent("USA")
        : countryFlagAccent(f.id);
    }
    displayFeaturesRef.current = feats;

    const maxCount = Math.max(2, ...Object.values(counts), 0);
    const countriesSource = map.getSource("countries") as maplibregl.GeoJSONSource | undefined;
    countriesSource?.setData({ type: "FeatureCollection", features: feats } as GeoJSON.GeoJSON);
    applyHeatmapTheme(map, mapThemeRef.current, maxCount);

    const dotsSource = map.getSource("dots") as maplibregl.GeoJSONSource | undefined;
    dotsSource?.setData(dotsGeoJson(filtered));
  }, []);

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

      // Initial counts by country for the first paint; rebuildGeo() below applies
      // the status filter and states-mode swap once layers/sources exist.
      const counts = countByUnit(locationsRef.current, { usaAsStates: false, states: null });
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

      // ── Deal route layers (rendered below dots) ──────────────────────
      const emptyFC = { type: "FeatureCollection" as const, features: [] as unknown[] };
      map.addSource("deal-routes", { type: "geojson", data: emptyFC as GeoJSON.GeoJSON });
      map.addSource("deal-airports", { type: "geojson", data: emptyFC as GeoJSON.GeoJSON });
      map.addSource("deal-route-prices", { type: "geojson", data: emptyFC as GeoJSON.GeoJSON });

      // Default (inactive) route arcs — thin semi-transparent lines
      map.addLayer({
        id: DEAL_ROUTES_LINE,
        type: "line",
        source: "deal-routes",
        paint: {
          "line-color": "rgba(203,213,225,0.25)",
          "line-width": 1.5,
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      // Active/highlighted route arc — thicker, animated dash
      map.addLayer({
        id: DEAL_ROUTES_ACTIVE,
        type: "line",
        source: "deal-routes",
        filter: ["==", ["get", "key"], ""],
        paint: {
          "line-color": "#2dd4bf",
          "line-width": 3,
          "line-dasharray": [2, 2],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      // Origin airport dots (amber)
      map.addLayer({
        id: DEAL_AIRPORTS_ORIGIN,
        type: "circle",
        source: "deal-airports",
        filter: ["==", ["get", "role"], "origin"],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 3, 8, 5, 14, 7],
          "circle-color": "#fbbf24",
          "circle-stroke-color": "rgba(251,191,36,0.4)",
          "circle-stroke-width": 2,
          "circle-opacity": 0.85,
        },
      });

      // Destination airport dots (teal/cyan)
      map.addLayer({
        id: DEAL_AIRPORTS_DEST,
        type: "circle",
        source: "deal-airports",
        filter: ["==", ["get", "role"], "dest"],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 3, 8, 5, 14, 7],
          "circle-color": "#2dd4bf",
          "circle-stroke-color": "rgba(45,212,191,0.4)",
          "circle-stroke-width": 2,
          "circle-opacity": 0.85,
        },
      });

      // Price labels at arc midpoints
      map.addLayer({
        id: DEAL_ROUTE_PRICES,
        type: "symbol",
        source: "deal-route-prices",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-offset": [0, -0.8],
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(15,23,42,0.85)",
          "text-halo-width": 1.5,
          "text-opacity": 0.9,
        },
      });

      // Animated dash offset for the active route arc
      {
        const routeStart = performance.now();
        const routePulse = (now: number) => {
          if (!map.getLayer(DEAL_ROUTES_ACTIVE)) return;
          const t = ((now - routeStart) % 1200) / 1200;
          // Animate by shifting the dash pattern phase via line-dasharray tweaking
          const dashLen = 2 + 2 * t;
          const gapLen = 4 - 2 * t;
          map.setPaintProperty(DEAL_ROUTES_ACTIVE, "line-dasharray", [dashLen, gapLen]);
          routePulseRafRef.current = requestAnimationFrame(routePulse);
        };
        routePulseRafRef.current = requestAnimationFrame(routePulse);
      }

      // Seed initial deal route data if already available
      if (dealRoutesRef.current.length > 0) {
        const rSrc = map.getSource("deal-routes") as maplibregl.GeoJSONSource;
        rSrc?.setData(routesGeoJson(dealRoutesRef.current) as GeoJSON.GeoJSON);
        const aSrc = map.getSource("deal-airports") as maplibregl.GeoJSONSource;
        aSrc?.setData(airportsGeoJson(dealRoutesRef.current) as GeoJSON.GeoJSON);
        const pSrc = map.getSource("deal-route-prices") as maplibregl.GeoJSONSource;
        pSrc?.setData(routePricesGeoJson(dealRoutesRef.current) as GeoJSON.GeoJSON);
      }

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

      // Pulse animation for flight-deal rings
      const start = performance.now();
      const pulse = (now: number) => {
        const t = ((now - start) % 1600) / 1600;
        if (map.getLayer(DOTS_DEAL)) {
          map.setPaintProperty(DOTS_DEAL, "circle-radius", 9 + 7 * t);
          map.setPaintProperty(DOTS_DEAL, "circle-stroke-opacity", 0.9 * (1 - t));
        }
        pulseRafRef.current = requestAnimationFrame(pulse);
      };
      pulseRafRef.current = requestAnimationFrame(pulse);

      loadedRef.current = true;
      // Apply status filter + states-mode (if already set) now that sources exist.
      rebuildGeo();

      map.on("click", (e: MapMouseEvent) => {
        if (pinDropRef.current) {
          callbacksRef.current.onPinDrop(e.lngLat.lat, e.lngLat.lng);
          return;
        }
        const dots = map.queryRenderedFeatures(e.point, { layers: [DOTS_CORE, DOTS_GLOW] });
        if (dots.length > 0) {
          callbacksRef.current.onDotClick(dots[0].properties.id as string);
          return;
        }
        const countries = map.queryRenderedFeatures(e.point, { layers: [FILL_LAYER] });
        if (countries.length > 0) {
          const props = countries[0].properties as { iso: string; name: string; count: number };
          const feature = displayFeaturesRef.current.find((f) => f.id === props.iso);
          let fitZoom = map.getZoom();
          if (feature) {
            const bounds = countryBoundsForClick(feature, e.lngLat.lng, e.lngLat.lat);
            // Panel opens for a country with wishes — keep it out of the fit area.
            const padding = visibleAreaPadding(props.count > 0);
            const camera = map.cameraForBounds(bounds, { padding, maxZoom: 7 });
            fitZoom = camera?.zoom ?? fitZoom;
            map.fitBounds(bounds, { padding, duration: 1100, maxZoom: 7 });
            lastFocusAtRef.current = performance.now();
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
        // Ignore the zoomend from a just-issued country/wish focus — its low fit
        // zoom on a phone screen must not be mistaken for a return to world view.
        if (performance.now() - lastFocusAtRef.current < 1600) return;
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
            cover: coverImageSrc(cover, 240),
          });
        } else if (countryHit) {
          const { name, count } = countryHit.properties as { name: string; count: number };
          setHover({
            x: e.point.x + 14,
            y: e.point.y + 14,
            name: count > 0 ? `${name} - ${count}` : name,
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
      cancelAnimationFrame(routePulseRafRef.current);
      Object.values(dimRafsRef.current).forEach(cancelAnimationFrame);
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep heatmap + dots in sync with locations, theme, status filter, and states mode.
  useEffect(() => {
    rebuildGeo();
  }, [locations, mapTheme, statusFilter, usaAsStates, states, rebuildGeo]);

  // Keep deal route layers in sync with dealRoutes prop.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const rSrc = map.getSource("deal-routes") as maplibregl.GeoJSONSource | undefined;
    const aSrc = map.getSource("deal-airports") as maplibregl.GeoJSONSource | undefined;
    const pSrc = map.getSource("deal-route-prices") as maplibregl.GeoJSONSource | undefined;
    if (!rSrc) return;
    if (dealRoutes.length === 0) {
      const empty = { type: "FeatureCollection" as const, features: [] as unknown[] } as GeoJSON.GeoJSON;
      rSrc.setData(empty);
      aSrc?.setData(empty);
      pSrc?.setData(empty);
    } else {
      rSrc.setData(routesGeoJson(dealRoutes) as GeoJSON.GeoJSON);
      aSrc?.setData(airportsGeoJson(dealRoutes) as GeoJSON.GeoJSON);
      pSrc?.setData(routePricesGeoJson(dealRoutes) as GeoJSON.GeoJSON);
    }
  }, [dealRoutes]);

  // Highlight the active deal route.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current || !map.getLayer(DEAL_ROUTES_ACTIVE)) return;
    map.setFilter(DEAL_ROUTES_ACTIVE, ["==", ["get", "key"], activeDealRoute ?? ""]);
  }, [activeDealRoute]);

  // Fly to a wish selected in the sidebar
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusPoint) return;
    const targetZoom = Math.max(map.getZoom(), 5.5);
    map.flyTo({
      center: [focusPoint.lng, focusPoint.lat],
      zoom: targetZoom,
      duration: 1400,
      // A wish/location selection always opens the panel — center in the visible area.
      padding: visibleAreaPadding(true),
    });
    lastFocusAtRef.current = performance.now();
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
      // Clear any panel padding left over from a country/wish fit so the world recenters.
      map.flyTo({ center: [20, 22], zoom: 1.6, duration: 1100, padding: 0 });
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
