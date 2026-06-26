/**
 * AirLabsProvider — real-time flight tracking via AirLabs.co API (FREE tier, 1000 req/month).
 * Maps cleanly to FlightTelemetry since AirLabs returns progress, ETA, airport codes, etc.
 *
 * Implements the sacred FlightTrackerProvider interface.
 */

import type { FlightTrackerProvider, FlightTelemetry } from './types';

/** Shape of a single flight in the AirLabs /flights response. */
export interface AirLabsFlightResult {
  flight_iata: string | null;
  flight_icao: string | null;
  dep_iata: string | null;
  dep_icao: string | null;
  arr_iata: string | null;
  arr_icao: string | null;
  dep_name?: string;
  arr_name?: string;
  status: string; // "scheduled" | "en-route" | "landed" | "cancelled" | "active" | etc.
  lat: number | null;
  lng: number | null;
  alt: number | null;     // meters
  dir: number | null;     // heading degrees
  speed: number | null;   // km/h
  dep_lat?: number;
  dep_lng?: number;
  arr_lat?: number;
  arr_lng?: number;
  percent?: number;       // 0–100
  eta?: number;           // Unix timestamp
  arr_estimated?: string; // ISO datetime
  dep_actual?: string;
  [key: string]: unknown;
}

export interface AirLabsResponse {
  response: AirLabsFlightResult[];
  error?: { code: string; message: string };
}

export interface AirLabsProviderOptions {
  apiKey: string;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = 'https://airlabs.co/api/v9';
const METERS_TO_FEET = 3.28084;
const KMH_TO_KNOTS = 0.539957;

/**
 * Normalize AirLabs status strings to our FlightTelemetry status enum.
 */
function normalizeStatus(raw: string): FlightTelemetry['status'] {
  const s = raw.toLowerCase();
  if (s === 'en-route' || s === 'active' || s === 'started') return 'enroute';
  if (s === 'landed') return 'landed';
  if (s === 'scheduled') return 'scheduled';
  return 'unknown';
}

/**
 * Map an AirLabs flight result to FlightTelemetry.
 * Exported for unit-testing with a sample payload (following the tequila.test.ts pattern).
 */
export function mapAirLabsToTelemetry(
  r: AirLabsFlightResult,
  flight: string,
  fetchedAt: string,
): FlightTelemetry {
  const altFeet = r.alt != null ? Math.round(r.alt * METERS_TO_FEET) : 0;
  const speedKnots = r.speed != null ? Math.round(r.speed * KMH_TO_KNOTS) : 0;
  const progress = r.percent != null ? Math.min(1, Math.max(0, r.percent / 100)) : 0;

  let eta = '';
  if (r.arr_estimated) {
    eta = r.arr_estimated;
  } else if (r.eta) {
    eta = new Date(r.eta * 1000).toISOString();
  }

  return {
    flight,
    status: normalizeStatus(r.status),
    from: {
      code: r.dep_iata ?? '???',
      lat: r.dep_lat ?? 0,
      lon: r.dep_lng ?? 0,
    },
    to: {
      code: r.arr_iata ?? '???',
      lat: r.arr_lat ?? 0,
      lon: r.arr_lng ?? 0,
    },
    position: {
      lat: r.lat ?? 0,
      lon: r.lng ?? 0,
    },
    altitude: altFeet,
    speed: speedKnots,
    progress,
    eta,
    fetchedAt,
  };
}

export class AirLabsProvider implements FlightTrackerProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: AirLabsProviderOptions) {
    if (!opts.apiKey) {
      throw new Error(
        'AirLabsProvider requires AIRLABS_API_KEY (Golden rule 5: no hardcoded keys).',
      );
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  }

  async track(flight: string): Promise<FlightTelemetry> {
    const clean = flight.trim().toUpperCase();
    const url = `${this.baseUrl}/flights?flight_iata=${encodeURIComponent(clean)}&api_key=${this.apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`AirLabs API error: ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as AirLabsResponse;

    if (body.error) {
      throw new Error(`AirLabs error: ${body.error.message}`);
    }

    if (!body.response || body.response.length === 0) {
      throw new Error(`AirLabs: no data found for flight "${flight}"`);
    }

    const fetchedAt = new Date().toISOString();
    return mapAirLabsToTelemetry(body.response[0]!, flight, fetchedAt);
  }
}
