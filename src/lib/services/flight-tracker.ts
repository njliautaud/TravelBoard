/**
 * Flight tracking service for TravelBoard.
 *
 * Uses OpenSky Network (free, no key) as the primary source, with optional
 * AirLabs fallback when AIRLABS_API_KEY is set. Wraps the providers from
 * @travelboard/core in a singleton with caching.
 */

import {
  OpenSkyProvider,
  AirLabsProvider,
  CompositeFlightTracker,
  MockFlightTracker,
  type FlightTrackerProvider,
  type FlightTelemetry,
} from "@travelboard/core";

// Re-export the telemetry type for convenience
export type { FlightTelemetry };

// ── Singleton tracker ───────────────────────────────────────────────────────

let _tracker: FlightTrackerProvider | null = null;

/**
 * Build the flight tracker provider cascade:
 *   1. AirLabs (if API key is set) — best data quality, has origin/dest/ETA
 *   2. OpenSky (free) — always available but no route info
 *   3. Mock — deterministic fallback so the app never crashes
 */
function buildTracker(): FlightTrackerProvider {
  const providers: FlightTrackerProvider[] = [];

  const airlabsKey = process.env.AIRLABS_API_KEY;
  if (airlabsKey) {
    providers.push(new AirLabsProvider({ apiKey: airlabsKey }));
  }

  providers.push(new OpenSkyProvider());
  providers.push(new MockFlightTracker());

  return new CompositeFlightTracker({
    providers,
    cacheTtlMs: 30_000, // 30s cache to match OpenSky refresh window
  });
}

function getTracker(): FlightTrackerProvider {
  if (!_tracker) {
    _tracker = buildTracker();
  }
  return _tracker;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Track a flight by its IATA flight number (e.g. "UA123", "BA456").
 * Returns live telemetry: position, altitude, speed, heading, origin,
 * destination, progress, and ETA.
 */
export async function trackFlight(flightNumber: string): Promise<FlightTelemetry> {
  const tracker = getTracker();
  return tracker.track(flightNumber);
}

/**
 * Lightweight summary of a tracked flight, suitable for API responses.
 */
export interface FlightSummary {
  flight: string;
  status: string;
  origin: string;
  destination: string;
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  heading: number | null;
  progress: number;
  eta: string;
  fetchedAt: string;
}

/**
 * Track a flight and return a simplified summary object.
 */
export async function trackFlightSummary(flightNumber: string): Promise<FlightSummary> {
  const tel = await trackFlight(flightNumber);

  return {
    flight: tel.flight,
    status: tel.status,
    origin: tel.from.code,
    destination: tel.to.code,
    lat: tel.position.lat,
    lon: tel.position.lon,
    altitude: tel.altitude,
    speed: tel.speed,
    heading: null, // OpenSky has true_track but it doesn't surface through the interface
    progress: tel.progress,
    eta: tel.eta,
    fetchedAt: tel.fetchedAt,
  };
}
