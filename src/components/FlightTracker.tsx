"use client";

/**
 * FlightTracker — flight number input with real-time position display.
 * Shows: flight number, origin -> destination, altitude, speed, progress bar, ETA.
 * Auto-refreshes every 30 seconds while tracking.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlightData {
  flight: string;
  status: string;
  origin: string;
  destination: string;
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  progress: number;
  eta: string;
  fetchedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  enroute: "In Flight",
  landed: "Landed",
  unknown: "Unknown",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500",
  enroute: "bg-green-500",
  landed: "bg-amber-500",
  unknown: "bg-slate-500",
};

const REFRESH_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FlightTracker() {
  const [input, setInput] = useState("");
  const [flight, setFlight] = useState<FlightData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFlight = useCallback(async (flightNum: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/track/${encodeURIComponent(flightNum.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Flight not found");
        setFlight(null);
        return;
      }
      setFlight(data);
    } catch {
      setError("Failed to fetch flight data");
      setFlight(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTrack = useCallback(() => {
    const trimmed = input.trim().toUpperCase();
    if (!trimmed) return;

    // Stop any existing tracking
    if (intervalRef.current) clearInterval(intervalRef.current);

    setTracking(true);
    void fetchFlight(trimmed);

    // Auto-refresh every 30s
    intervalRef.current = setInterval(() => {
      void fetchFlight(trimmed);
    }, REFRESH_INTERVAL_MS);
  }, [input, fetchFlight]);

  const handleStop = useCallback(() => {
    setTracking(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const progressPct = flight ? Math.round(flight.progress * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
      {/* Header */}
      <h2 className="mb-4 text-lg font-semibold text-amber-400">
        Live Flight Tracker
      </h2>

      {/* Input row */}
      <div className="mb-6 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleTrack()}
          placeholder="Flight number (e.g. UA123)"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
        />
        {tracking ? (
          <button
            onClick={handleStop}
            className="rounded-lg bg-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-600"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleTrack}
            disabled={!input.trim() || loading}
            className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "..." : "Track"}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-950/50 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Flight data cards */}
      {flight && (
        <div className="space-y-4">
          {/* Status bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-slate-100">
                {flight.flight}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium text-white ${STATUS_COLORS[flight.status] ?? "bg-slate-500"}`}
              >
                {STATUS_LABELS[flight.status] ?? flight.status}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Updated {new Date(flight.fetchedAt).toLocaleTimeString()}
            </span>
          </div>

          {/* Route */}
          <div className="flex items-center gap-3 text-slate-300">
            <span className="text-lg font-semibold">{flight.origin}</span>
            <div className="flex flex-1 items-center gap-1">
              <div className="h-px flex-1 bg-slate-700" />
              <svg
                className="h-4 w-4 text-amber-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
              <div className="h-px flex-1 bg-slate-700" />
            </div>
            <span className="text-lg font-semibold">{flight.destination}</span>
          </div>

          {/* Progress bar */}
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Progress</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Data grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DataCard
              label="Altitude"
              value={flight.altitude > 0 ? `${flight.altitude.toLocaleString()} ft` : "--"}
            />
            <DataCard
              label="Speed"
              value={flight.speed > 0 ? `${flight.speed} kts` : "--"}
            />
            <DataCard
              label="Position"
              value={`${flight.lat.toFixed(2)}, ${flight.lon.toFixed(2)}`}
            />
            <DataCard
              label="ETA"
              value={
                flight.eta
                  ? new Date(flight.eta).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--"
              }
            />
          </div>

          {/* Auto-refresh indicator */}
          {tracking && (
            <p className="text-center text-xs text-slate-600">
              Auto-refreshing every 30 seconds
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!flight && !error && !loading && (
        <p className="text-center text-sm text-slate-600">
          Enter a flight number to track its live position
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DataCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-200">{value}</p>
    </div>
  );
}
