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
  onCountryClick: (code: string, name: string) => void;
  onDotClick: (id: string) => void;
  onPinDrop: (lat: number, lng: number) => void;
  onZoomStateChange?: (zoomedIn: boolean) => void;
  /** Show the right-click "Add wish here" menu (only on your own editable board). */
  canAddWish: boolean;
  onAddWishHere: (lat: number, lng: number) => void;
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

/**
 * Below this zoom the map is treated as world view (panel closes, world button
 * hides). Raised from 2.5 → 4.0 so the right panel closes after roughly half the
 * zoom-out distance from a focused wish (~5.5) instead of the full way out.
 */
const WORLD_VIEW_ZOOM = 4.0;

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

// --- Cinematic 2D⇄3D terrain (active only while the map is tilted) ---
const TERRAIN_SOURCE = "terrain-dem";
const HILLSHADE_LAYER = "terrain-hillshade";
const OCEAN_MASK_SOURCE = "ocean-mask";
const OCEAN_MASK_LAYER = "ocean-mask-fill";
const OCEAN_COLOR = "#0a0f1c"; // smooth, dark, flat sea
// Free global DEM (Tilezen Terrarium tiles on AWS Open Data, CORS-enabled).
const TERRAIN_DEM_TILES = ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"];
const TILT_ENTER_DEG = 3; // pitch above this turns terrain + rotation ON
const TILT_EXIT_DEG = 1; // pitch below this turns them OFF (hysteresis band)

/**
 * Zoom-dependent terrain exaggeration. Mountain ranges are invisibly small
 * relative to the globe at low zoom, so we amplify them hard when zoomed out and
 * taper to realistic heights up close. MapLibre's terrain `exaggeration` is a
 * plain number (no zoom expressions), so a zoom listener applies this curve live.
 *   z ≤ 3  (continent/global) → 4.0   ranges like the Andes pop from afar
 *   z = 7  (country/state)     → 2.4
 *   z ≥ 12 (city/close)        → 1.2   natural & accurate up close
 */
function exaggerationForZoom(zoom: number): number {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  if (zoom <= 3) return 4.0;
  if (zoom <= 7) return lerp(4.0, 2.4, (zoom - 3) / 4);
  if (zoom <= 12) return lerp(2.4, 1.2, (zoom - 7) / 5);
  return 1.2;
}

/**
 * A "world rectangle with every country punched out as a hole" polygon — i.e.
 * the oceans. Drawn as a flat dark fill above the hillshade so the sea stays a
 * smooth dark surface (hiding the DEM's seafloor bathymetry) while the land
 * holes let the 3D land relief + hillshade show through.
 */
function buildOceanMask(features: GeoFeature[]): GeoJSON.Feature<GeoJSON.Polygon> {
  const world: number[][] = [
    [-180, -89], [180, -89], [180, 89], [-180, 89], [-180, -89],
  ];
  const holes: number[][][] = [];
  for (const f of features) {
    if (f.geometry.type === "Polygon") {
      holes.push((f.geometry.coordinates as number[][][])[0]);
    } else {
      for (const poly of f.geometry.coordinates as number[][][][]) holes.push(poly[0]);
    }
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [world, ...holes] },
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
    // Rotation is only unlocked in the tilted (3D) state — flat view is locked
    // to north. Below the tilt threshold, ignore the dual-button drag.
    if (map.getPitch() <= TILT_EXIT_DEG) {
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

/**
 * Cinematic 2D⇄3D: realistic LAND topography + free rotation appear ONLY while
 * the map is tilted. Flat view stays rigid and fast (no DEM fetched, bearing
 * locked to north, rotation gestures off). The moment the user pitches up
 * (two-finger swipe-down), the DEM terrain morphs in, the flat country fill is
 * hidden so the land relief shows through, and 360° rotation unlocks; pitch back
 * to flat and it smoothly flattens, removes the terrain, restores the fill, and
 * relocks to north. A hysteresis band avoids flicker around the threshold.
 *
 * Land vs water: a hillshade gives the land its visible "pop" (raised geometry
 * alone is nearly invisible on the flat dark basemap). But hillshade would also
 * shade the DEM's seafloor bathymetry and make the ocean look like high-contrast
 * underwater terrain — so a flat dark "ocean mask" (a world polygon with every
 * country cut out) is drawn above the hillshade to keep the sea smooth and dark
 * while the land holes show the relief.
 */
function attachTiltTerrain(map: MlMap, getCountries: () => GeoFeature[]): () => void {
  let tilted = false;
  let raf = 0;
  // 0 → 1 tilt morph factor. Actual terrain exaggeration = morph × the
  // zoom-dependent curve, so it ramps in on tilt AND tracks zoom while tilted.
  let morph = 0;
  // One-shot "initial style is ready" flag. We must NOT use isStyleLoaded() per
  // event: once terrain is active its DEM tiles stream continuously and
  // isStyleLoaded() stays false, which would freeze the flatten transition.
  let ready = map.isStyleLoaded();
  const onLoad = () => {
    ready = true;
  };
  map.on("load", onLoad);

  // Lazily create the DEM source, the land hillshade, and the flat ocean mask
  // the first time the user tilts, so the flat view never fetches elevation tiles
  // or builds the mask geometry.
  const beforeId = () => (map.getLayer(FILL_LAYER) ? FILL_LAYER : undefined);
  const ensureTerrainLayers = () => {
    if (!map.getSource(TERRAIN_SOURCE)) {
      map.addSource(TERRAIN_SOURCE, {
        type: "raster-dem",
        tiles: TERRAIN_DEM_TILES,
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 14,
        attribution:
          '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Tilezen Joerd</a>',
      });
    }
    // Shaded relief gives the land its visible depth (below the country layers).
    if (!map.getLayer(HILLSHADE_LAYER)) {
      map.addLayer(
        {
          id: HILLSHADE_LAYER,
          type: "hillshade",
          source: TERRAIN_SOURCE,
          layout: { visibility: "none" },
          paint: {
            "hillshade-exaggeration": 0.55,
            "hillshade-shadow-color": "#0b1220",
            "hillshade-highlight-color": "#b8c6dc",
            "hillshade-accent-color": "#334155",
          },
        },
        beforeId(),
      );
    }
    // Flat dark ocean over the seafloor relief (above hillshade, below countries).
    if (!map.getSource(OCEAN_MASK_SOURCE)) {
      const countries = getCountries();
      if (countries.length) {
        map.addSource(OCEAN_MASK_SOURCE, { type: "geojson", data: buildOceanMask(countries) });
        map.addLayer(
          {
            id: OCEAN_MASK_LAYER,
            type: "fill",
            source: OCEAN_MASK_SOURCE,
            layout: { visibility: "none" },
            paint: { "fill-color": OCEAN_COLOR, "fill-opacity": 1 },
          },
          beforeId(),
        );
      }
    }
  };

  const setTerrainLayersVisible = (visible: boolean) => {
    const v = visible ? "visible" : "none";
    if (map.getLayer(HILLSHADE_LAYER)) map.setLayoutProperty(HILLSHADE_LAYER, "visibility", v);
    if (map.getLayer(OCEAN_MASK_LAYER)) map.setLayoutProperty(OCEAN_MASK_LAYER, "visibility", v);
  };

  // While tilted, hide the flat country fill so the land's 3D relief (the draped
  // basemap on the DEM) shows through. Opacity 0 — not visibility:none — so the
  // fill stays query-able and country clicks keep working in 3D. We snapshot the
  // live value so it restores exactly when flattening.
  let savedFillOpacity: unknown;
  const hideLandFill = () => {
    if (!map.getLayer(FILL_LAYER)) return;
    if (savedFillOpacity === undefined) {
      savedFillOpacity = map.getPaintProperty(FILL_LAYER, "fill-opacity");
    }
    map.setPaintProperty(FILL_LAYER, "fill-opacity", 0);
  };
  const restoreLandFill = () => {
    if (map.getLayer(FILL_LAYER) && savedFillOpacity !== undefined) {
      map.setPaintProperty(FILL_LAYER, "fill-opacity", savedFillOpacity as never);
      savedFillOpacity = undefined;
    }
  };

  // Apply the current exaggeration = morph × zoom curve. Called every frame of
  // the tilt morph AND on every zoom change while tilted, so ranges stay big
  // when zoomed out and normalize smoothly as you zoom in.
  const applyTerrain = () => {
    if (morph <= 0) return;
    map.setTerrain({
      source: TERRAIN_SOURCE,
      exaggeration: morph * exaggerationForZoom(map.getZoom()),
    });
  };

  // Ramp the morph factor so the relief grows/shrinks instead of popping.
  const animateMorph = (target: number, onDone?: () => void) => {
    cancelAnimationFrame(raf);
    const from = morph;
    const start = performance.now();
    const duration = 600;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      morph = from + (target - from) * easeOutCubic(t);
      applyTerrain();
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        morph = target;
        onDone?.();
      }
    };
    raf = requestAnimationFrame(step);
  };

  const enterTilt = () => {
    ensureTerrainLayers();
    setTerrainLayersVisible(true); // shaded land relief + flat dark ocean
    hideLandFill(); // reveal the land terrain by dropping the flat country tint
    // Unlock 360° rotation: touch twist + the dual-button drag (gated on pitch).
    map.touchZoomRotate.enableRotation();
    animateMorph(1);
  };

  const exitTilt = () => {
    // Relock to north and disable rotation gestures.
    map.touchZoomRotate.disableRotation();
    // Animate the bearing back to north on the next frame — starting an easeTo
    // synchronously from inside a pitch event handler is re-entrant and throws.
    if (Math.abs(map.getBearing()) > 0.01) {
      requestAnimationFrame(() => {
        if (!tilted && Math.abs(map.getBearing()) > 0.01) {
          map.easeTo({ bearing: 0, duration: 500, easing: (t) => 1 - Math.pow(1 - t, 3) });
        }
      });
    }
    animateMorph(0, () => {
      cancelAnimationFrame(raf);
      morph = 0;
      map.setTerrain(null);
      setTerrainLayersVisible(false); // hide hillshade + ocean mask in 2D
      restoreLandFill(); // bring the flat country tint back for 2D view
    });
  };

  const onPitch = () => {
    if (!ready) return;
    const pitch = map.getPitch();
    if (!tilted && pitch > TILT_ENTER_DEG) {
      tilted = true;
      enterTilt();
    } else if (tilted && pitch < TILT_EXIT_DEG) {
      tilted = false;
      exitTilt();
    }
  };

  // While tilted, re-apply the zoom-dependent exaggeration as the user zooms so
  // the mountains scale smoothly (the 'zoom' event fires per frame during zoom).
  const onZoom = () => {
    if (morph > 0) applyTerrain();
  };

  map.on("pitch", onPitch);
  map.on("pitchend", onPitch);
  map.on("zoom", onZoom);

  return () => {
    cancelAnimationFrame(raf);
    map.off("pitch", onPitch);
    map.off("pitchend", onPitch);
    map.off("zoom", onZoom);
    map.off("load", onLoad);
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
    onCountryClick,
    onDotClick,
    onPinDrop,
    onZoomStateChange,
    canAddWish,
    onAddWishHere,
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
  const canAddWishRef = useRef(canAddWish);
  const callbacksRef = useRef({ onCountryClick, onDotClick, onPinDrop, onZoomStateChange, onAddWishHere });
  const pulseRafRef = useRef<number>(0);
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
  // Right-click "Add wish here" menu over a country.
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    name: string;
    lat: number;
    lng: number;
  } | null>(null);

  const mapThemeRef = useRef(mapTheme);
  mapThemeRef.current = mapTheme;
  locationsRef.current = locations;
  statusFilterRef.current = statusFilter;
  usaAsStatesRef.current = usaAsStates;
  statesRef.current = states;
  pinDropRef.current = pinDropMode;
  canAddWishRef.current = canAddWish;
  callbacksRef.current = { onCountryClick, onDotClick, onPinDrop, onZoomStateChange, onAddWishHere };

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
    // Flat view starts rotation-locked (touch twist off); the tilt engine
    // unlocks it on pitch. Two-finger pitch (touchPitch) stays enabled.
    map.touchZoomRotate.disableRotation();
    const detachTiltTerrain = attachTiltTerrain(map, () => countriesRef.current);
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

      // Right-click a country -> floating "Add wish here" button (own board only).
      map.on("contextmenu", (e: MapMouseEvent) => {
        if (pinDropRef.current || !canAddWishRef.current) {
          setCtxMenu(null);
          return;
        }
        const hits = map.queryRenderedFeatures(e.point, { layers: [FILL_LAYER] });
        if (hits.length === 0) {
          setCtxMenu(null);
          return;
        }
        const { name } = hits[0].properties as { name: string };
        setCtxMenu({ x: e.point.x, y: e.point.y, name, lat: e.lngLat.lat, lng: e.lngLat.lng });
      });

      map.on("click", (e: MapMouseEvent) => {
        setCtxMenu(null);
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
        setCtxMenu(null);
      });
    });

    return () => {
      detachDualRotate();
      detachTiltTerrain();
      cancelAnimationFrame(pulseRafRef.current);
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
      {ctxMenu && (
        <div
          className="absolute z-20 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/95 shadow-xl"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button
            type="button"
            onClick={() => {
              callbacksRef.current.onAddWishHere(ctxMenu.lat, ctxMenu.lng);
              setCtxMenu(null);
            }}
            className="flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-100 hover:bg-amber-500/15 hover:text-amber-200"
          >
            <span className="text-amber-400">＋</span>
            Add wish in {ctxMenu.name}
          </button>
        </div>
      )}
    </div>
  );
});
