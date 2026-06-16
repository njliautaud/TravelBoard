"use client";

/**
 * MemoryMap — pin map showing visited locations from Trip data.
 * Features: great-circle arcs, stats overlay, country highlighting.
 * Can work standalone or as an overlay mode for the existing TravelMap.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TripPin {
  id: string;
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  startDate: string | null;
  note: string | null;
  rating: number | null;
}

interface ArcData {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  points: { lat: number; lon: number }[];
  distanceMiles: number;
}

interface TravelStats {
  countries: number;
  continents: number;
  miles: number;
  trips: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MemoryMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [trips, setTrips] = useState<TripPin[]>([]);
  const [arcs, setArcs] = useState<ArcData[]>([]);
  const [stats, setStats] = useState<TravelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<TripPin | null>(null);

  // Fetch trips and stats
  useEffect(() => {
    async function load() {
      try {
        const [tripsRes, statsRes] = await Promise.all([
          fetch("/api/trips"),
          fetch("/api/trips/stats"),
        ]);
        if (tripsRes.ok) {
          const data = await tripsRes.json();
          setTrips(data.trips ?? []);
        }
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data.stats ?? null);
          setArcs(data.arcs ?? []);
        }
      } catch {
        // Silent fail — will show empty state
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MlMap({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          "natural-earth": {
            type: "raster",
            tiles: [
              "https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution: "&copy; CARTO",
          },
        },
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#0f172a" },
          },
          {
            id: "basemap",
            type: "raster",
            source: "natural-earth",
            paint: { "raster-opacity": 0.6 },
          },
        ],
      },
      center: [0, 25],
      zoom: 1.5,
      attributionControl: false,
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add trip pins and arcs to map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || loading) return;

    const addLayers = () => {
      // --- Arcs ---
      if (arcs.length > 0) {
        const arcFeatures = arcs.map((arc, i) => ({
          type: "Feature" as const,
          properties: { distance: arc.distanceMiles },
          geometry: {
            type: "LineString" as const,
            coordinates: arc.points.map((p) => [p.lon, p.lat]),
          },
          id: i,
        }));

        if (map.getSource("trip-arcs")) {
          (map.getSource("trip-arcs") as maplibregl.GeoJSONSource).setData({
            type: "FeatureCollection",
            features: arcFeatures,
          });
        } else {
          map.addSource("trip-arcs", {
            type: "geojson",
            data: { type: "FeatureCollection", features: arcFeatures },
          });
          map.addLayer({
            id: "trip-arcs-layer",
            type: "line",
            source: "trip-arcs",
            paint: {
              "line-color": "#f59e0b",
              "line-width": 1.5,
              "line-opacity": 0.4,
              "line-dasharray": [4, 4],
            },
          });
        }
      }

      // --- Trip pins ---
      if (trips.length > 0) {
        const pinFeatures = trips.map((t) => ({
          type: "Feature" as const,
          properties: {
            id: t.id,
            city: t.city,
            country: t.country,
            rating: t.rating,
          },
          geometry: {
            type: "Point" as const,
            coordinates: [t.lon, t.lat],
          },
        }));

        if (map.getSource("trip-pins")) {
          (map.getSource("trip-pins") as maplibregl.GeoJSONSource).setData({
            type: "FeatureCollection",
            features: pinFeatures,
          });
        } else {
          map.addSource("trip-pins", {
            type: "geojson",
            data: { type: "FeatureCollection", features: pinFeatures },
          });

          // Glow circle behind pin
          map.addLayer({
            id: "trip-pins-glow",
            type: "circle",
            source: "trip-pins",
            paint: {
              "circle-radius": 12,
              "circle-color": "#f59e0b",
              "circle-opacity": 0.15,
              "circle-blur": 1,
            },
          });

          // Pin dot
          map.addLayer({
            id: "trip-pins-dot",
            type: "circle",
            source: "trip-pins",
            paint: {
              "circle-radius": 5,
              "circle-color": "#f59e0b",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#0f172a",
            },
          });

          // City labels
          map.addLayer({
            id: "trip-pins-label",
            type: "symbol",
            source: "trip-pins",
            layout: {
              "text-field": ["get", "city"],
              "text-size": 11,
              "text-offset": [0, 1.5],
              "text-anchor": "top",
              "text-font": ["Open Sans Regular"],
            },
            paint: {
              "text-color": "#cbd5e1",
              "text-halo-color": "#0f172a",
              "text-halo-width": 1,
            },
          });
        }
      }
    };

    if (map.loaded()) {
      addLayers();
    } else {
      map.on("load", addLayers);
    }
  }, [trips, arcs, loading]);

  // Click handler for pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["trip-pins-dot"],
      });
      if (features.length > 0) {
        const props = features[0]!.properties;
        const trip = trips.find((t) => t.id === props?.id);
        if (trip) setSelectedTrip(trip);
      }
    };

    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [trips]);

  const handleClosePopup = useCallback(() => setSelectedTrip(null), []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-800">
      {/* Map container */}
      <div ref={containerRef} className="h-full w-full" style={{ minHeight: 400 }} />

      {/* Stats overlay */}
      {stats && (
        <div className="absolute left-4 top-4 rounded-lg border border-slate-700 bg-slate-950/90 p-4 backdrop-blur-sm">
          <h3 className="mb-3 text-sm font-semibold text-amber-400">
            Travel Stats
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <StatItem label="Countries" value={stats.countries} />
            <StatItem label="Continents" value={stats.continents} />
            <StatItem label="Trips" value={stats.trips} />
            <StatItem
              label="Miles"
              value={stats.miles.toLocaleString()}
            />
          </div>
        </div>
      )}

      {/* Selected trip popup */}
      {selectedTrip && (
        <div className="absolute bottom-4 left-4 right-4 max-w-sm rounded-lg border border-slate-700 bg-slate-950/95 p-4 backdrop-blur-sm sm:left-auto">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-slate-100">
                {selectedTrip.city}
              </h4>
              <p className="text-sm text-slate-400">{selectedTrip.country}</p>
            </div>
            <button
              onClick={handleClosePopup}
              className="text-slate-500 hover:text-slate-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {selectedTrip.startDate && (
            <p className="text-xs text-slate-500">
              {new Date(selectedTrip.startDate).toLocaleDateString()}
            </p>
          )}
          {selectedTrip.rating != null && (
            <p className="mt-1 text-sm text-amber-400">
              {"*".repeat(selectedTrip.rating)}
              {"*".repeat(5 - selectedTrip.rating)}
            </p>
          )}
          {selectedTrip.note && (
            <p className="mt-2 text-sm text-slate-300">{selectedTrip.note}</p>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
          <p className="text-sm text-slate-400">Loading memories...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && trips.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-slate-400">No trips yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Add your first trip to see it on the map
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-100">{value}</p>
    </div>
  );
}
