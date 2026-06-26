/**
 * MockFlightTracker — deterministic, offline live-tracking source for Live mode dev.
 * Animates a flight along the great circle between two airports based on wall-clock time, so the
 * board shows realistic movement with zero keys. Implements the sacred FlightTrackerProvider shape.
 */

import type { FlightTrackerProvider, FlightTelemetry } from './types';
import { ORIGIN_AIRPORTS } from '../data/airports';
import { DESTINATIONS } from '../data/destinations';
import { haversineMiles, interpolateGreatCircle } from '../geo';
import { hash01 } from '../fares/model';

type Pt = { code: string; lat: number; lon: number };

function resolvePoint(code: string): Pt {
  const a = ORIGIN_AIRPORTS.find((x) => x.code === code);
  if (a) return { code: a.code, lat: a.lat, lon: a.lon };
  const d = DESTINATIONS.find((x) => x.code === code);
  if (d) return { code: d.code, lat: d.lat, lon: d.lon };
  return { code, lat: 0, lon: 0 };
}

export class MockFlightTracker implements FlightTrackerProvider {
  /**
   * @param now optional clock override (mostly for tests). Defaults to real time.
   * The flight string may be "MCO-LIS" to pin a route; otherwise a deterministic route is derived.
   */
  async track(flight: string, now: Date = new Date()): Promise<FlightTelemetry> {
    const [fromCode, toCode] = flight.includes('-')
      ? flight.split('-')
      : deriveRoute(flight);
    const from = resolvePoint(fromCode!);
    const to = resolvePoint(toCode!);

    const distance = haversineMiles(from, to);
    const cruiseSpeed = 480; // knots ~ nmi/h; good enough for mock
    const durationHrs = Math.max(1, distance / (cruiseSpeed * 1.15));
    const durationMs = durationHrs * 3600_000;

    // Deterministic departure: anchor the flight so it loops over its duration based on `now`.
    const phase = hash01(flight);
    const elapsed = ((now.getTime() / durationMs + phase) % 1) * durationMs;
    const progress = Math.min(1, Math.max(0, elapsed / durationMs));

    const position = interpolateGreatCircle(from, to, progress);
    const status: FlightTelemetry['status'] =
      progress <= 0.001 ? 'scheduled' : progress >= 0.999 ? 'landed' : 'enroute';
    const altitude = status === 'enroute' ? 35000 : status === 'landed' ? 0 : 0;
    const eta = new Date(now.getTime() + (1 - progress) * durationMs).toISOString();

    return {
      flight,
      status,
      from,
      to,
      position,
      altitude,
      speed: status === 'enroute' ? cruiseSpeed : 0,
      progress,
      eta,
      fetchedAt: now.toISOString(),
    };
  }
}

function deriveRoute(flight: string): [string, string] {
  const origins = ORIGIN_AIRPORTS;
  const dests = DESTINATIONS;
  const o = origins[Math.floor(hash01(flight + ':o') * origins.length)]!;
  const d = dests[Math.floor(hash01(flight + ':d') * dests.length)]!;
  return [o.code, d.code];
}
