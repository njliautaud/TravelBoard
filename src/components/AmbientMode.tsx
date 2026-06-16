"use client";

/**
 * AmbientMode — ambient display with day/night terminator, world clocks,
 * travel stats ticker, and subtle animation. Designed for an always-on
 * display (TV, tablet, etc.).
 */

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TravelStats {
  countries: number;
  continents: number;
  miles: number;
  trips: number;
}

interface ClockZone {
  label: string;
  tz: string;
}

const CLOCKS: ClockZone[] = [
  { label: "New York", tz: "America/New_York" },
  { label: "London", tz: "Europe/London" },
  { label: "Dubai", tz: "Asia/Dubai" },
  { label: "Tokyo", tz: "Asia/Tokyo" },
  { label: "Sydney", tz: "Australia/Sydney" },
];

const TERMINATOR_UPDATE_MS = 60_000; // update terminator every minute

// ---------------------------------------------------------------------------
// Terminator geometry
// ---------------------------------------------------------------------------

/**
 * Compute the night-side polygon for the current time.
 * Inlined to avoid importing server-only geo.ts in a client component.
 */
function computeTerminator(date: Date): GeoJSON.Feature {
  const DEG2RAD = Math.PI / 180;

  // Subsolar point
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start) / 86400000);
  const decl = -23.44 * Math.cos(DEG2RAD * (360 / 365) * (dayOfYear + 10));
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const subLon = -15 * (utcHours - 12);
  const declRad = decl * DEG2RAD;

  // Generate terminator line
  const termPoints: [number, number][] = [];
  for (let lonDeg = -180; lonDeg <= 180; lonDeg += 2) {
    const hRad = (lonDeg - subLon) * DEG2RAD;
    const tanDecl = Math.tan(declRad);
    let lat: number;
    if (Math.abs(tanDecl) < 1e-12) {
      lat = 0;
    } else {
      lat = Math.atan(-Math.cos(hRad) / tanDecl) / DEG2RAD;
    }
    termPoints.push([lonDeg, lat]);
  }

  // Determine night side: check if north pole is dark
  const northDark = (() => {
    const phi = 89 * DEG2RAD;
    const delta = decl * DEG2RAD;
    const h = (0 - subLon) * DEG2RAD;
    const elev = Math.asin(
      Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(h),
    );
    return elev <= 0;
  })();

  const capLat = northDark ? 90 : -90;
  const coords: [number, number][] = [];

  if (northDark) {
    for (const p of termPoints) coords.push(p);
    coords.push([180, capLat]);
    coords.push([-180, capLat]);
  } else {
    for (let i = termPoints.length - 1; i >= 0; i--) coords.push(termPoints[i]!);
    coords.push([-180, capLat]);
    coords.push([180, capLat]);
  }
  coords.push(coords[0]!);

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AmbientMode() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [stats, setStats] = useState<TravelStats | null>(null);
  const [now, setNow] = useState(new Date());
  const [tickerIdx, setTickerIdx] = useState(0);

  // Clock tick — update every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Stats ticker rotation
  useEffect(() => {
    if (!stats) return;
    const id = setInterval(() => setTickerIdx((i) => (i + 1) % 4), 5000);
    return () => clearInterval(id);
  }, [stats]);

  // Fetch travel stats
  useEffect(() => {
    fetch("/api/trips/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.stats) setStats(d.stats); })
      .catch(() => {});
  }, []);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MlMap({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          "carto-dark": {
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
            paint: { "background-color": "#020617" }, // slate-950
          },
          {
            id: "basemap",
            type: "raster",
            source: "carto-dark",
            paint: { "raster-opacity": 0.5 },
          },
        ],
      },
      center: [0, 20],
      zoom: 1.3,
      attributionControl: false,
      interactive: false, // Ambient — no interaction
    });

    map.on("load", () => {
      // Add terminator source
      map.addSource("terminator", {
        type: "geojson",
        data: computeTerminator(new Date()),
      });
      map.addLayer({
        id: "terminator-fill",
        type: "fill",
        source: "terminator",
        paint: {
          "fill-color": "#000000",
          "fill-opacity": 0.45,
        },
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update terminator position every minute
  useEffect(() => {
    const id = setInterval(() => {
      const map = mapRef.current;
      if (!map) return;
      const src = map.getSource("terminator") as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData({
          type: "FeatureCollection",
          features: [computeTerminator(new Date())],
        });
      }
    }, TERMINATOR_UPDATE_MS);
    return () => clearInterval(id);
  }, []);

  // Ticker messages
  const tickerMessages = stats
    ? [
        `${stats.trips} trips across ${stats.countries} countries`,
        `${stats.continents} continents explored`,
        `${stats.miles.toLocaleString()} miles traveled`,
        "Where to next?",
      ]
    : ["Loading travel stats..."];

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      {/* Map */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Top gradient fade */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-slate-950/80 to-transparent" />

      {/* Bottom gradient fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950/90 to-transparent" />

      {/* World clocks — top center */}
      <div className="absolute inset-x-0 top-6 flex justify-center">
        <div className="flex gap-6 rounded-xl border border-slate-800/50 bg-slate-950/70 px-6 py-3 backdrop-blur-sm">
          {CLOCKS.map((clock) => (
            <WorldClock key={clock.tz} zone={clock} now={now} />
          ))}
        </div>
      </div>

      {/* Stats ticker — bottom center */}
      <div className="absolute inset-x-0 bottom-8 flex justify-center">
        <div className="rounded-lg border border-slate-800/30 bg-slate-950/60 px-8 py-3 backdrop-blur-sm">
          <p
            className="text-center text-sm font-light tracking-wide text-amber-400/80 transition-opacity duration-1000"
            key={tickerIdx}
          >
            {tickerMessages[tickerIdx % tickerMessages.length]}
          </p>
        </div>
      </div>

      {/* Subtle date display — bottom left */}
      <div className="absolute bottom-8 left-6">
        <p className="text-xs text-slate-600">
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WorldClock({ zone, now }: { zone: ClockZone; now: Date }) {
  const time = now.toLocaleTimeString("en-US", {
    timeZone: zone.tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const hours = parseInt(
    now.toLocaleString("en-US", { timeZone: zone.tz, hour: "numeric", hour12: false }),
    10,
  );
  const isNight = hours < 6 || hours >= 20;

  return (
    <div className="text-center">
      <p className="text-xs text-slate-500">{zone.label}</p>
      <p className={`text-lg font-light tabular-nums ${isNight ? "text-slate-400" : "text-slate-200"}`}>
        {time}
      </p>
    </div>
  );
}
