/**
 * OpenSkyProvider — FREE live flight tracking via the OpenSky Network REST API.
 * No key required for basic use; optional credentials for higher rate limits.
 *
 * Challenge: OpenSky uses ICAO callsigns (e.g. "UAL123"), not IATA flight numbers ("UA123").
 * We include a mapping for major airlines.
 *
 * Implements the sacred FlightTrackerProvider interface.
 */

import type { FlightTrackerProvider, FlightTelemetry } from './types';

// ── IATA → ICAO mapping for major airlines ──────────────────────────────────

const IATA_TO_ICAO: Record<string, string> = {
  AA: 'AAL', UA: 'UAL', DL: 'DAL', WN: 'SWA', B6: 'JBU', AS: 'ASA', NK: 'NKS',
  F9: 'FFT', G4: 'AAY', HA: 'HAL', SY: 'SCX',
  BA: 'BAW', LH: 'DLH', AF: 'AFR', KL: 'KLM', IB: 'IBE', AZ: 'ITY', SK: 'SAS',
  LX: 'SWR', OS: 'AUA', SN: 'BEL', TP: 'TAP', TK: 'THY', EI: 'EIN',
  FR: 'RYR', U2: 'EZY', W6: 'WZZ', VY: 'VLG',
  EK: 'UAE', QR: 'QTR', EY: 'ETD', SV: 'SVA', GF: 'GFA',
  SQ: 'SIA', CX: 'CPA', QF: 'QFA', NZ: 'ANZ', JL: 'JAL', NH: 'ANA',
  KE: 'KAL', OZ: 'AAR', CI: 'CAL', BR: 'EVA', TG: 'THA', MH: 'MAS',
  AI: 'AIC', CA: 'CCA', MU: 'CES', CZ: 'CSN', HU: 'CHH',
  AC: 'ACA', WS: 'WJA', AM: 'AMX', AV: 'AVA', LA: 'LAN', CM: 'CMP',
  ET: 'ETH', SA: 'SAA', MS: 'MSR',
};

/** Raw OpenSky state vector (array positions per their API docs). */
interface OpenSkyStateVector {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  time_position: number | null;
  last_contact: number;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;
  on_ground: boolean;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  sensors: number[] | null;
  geo_altitude: number | null;
  squawk: string | null;
  spi: boolean;
  position_source: number;
}

interface OpenSkyResponse {
  time: number;
  states: (string | number | boolean | null)[][] | null;
}

export interface OpenSkyProviderOptions {
  /** Optional username for higher rate limits */
  username?: string;
  /** Optional password for higher rate limits */
  password?: string;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = 'https://opensky-network.org/api';
const METERS_TO_FEET = 3.28084;
const MPS_TO_KNOTS = 1.94384;

/**
 * Parse a flight string like "UA123" into candidate ICAO callsigns.
 * OpenSky pads callsigns to 8 chars with spaces, so we trim when comparing.
 */
export function flightToCallsigns(flight: string): string[] {
  const clean = flight.trim().toUpperCase();
  const candidates: string[] = [];

  // Try to split into airline code + number
  const match = clean.match(/^([A-Z]{2})(\d+)$/);
  if (match) {
    const [, iata, num] = match;
    const icao = IATA_TO_ICAO[iata!];
    if (icao) {
      candidates.push(`${icao}${num}`);    // "UAL123"
      candidates.push(`${icao}${num} `);   // padded variant
    }
    candidates.push(`${iata}${num}`);       // "UA123" — some carriers use IATA in callsign
  }

  // If it's already 3-letter ICAO prefix + digits, use as-is
  const icaoMatch = clean.match(/^([A-Z]{3})(\d+)$/);
  if (icaoMatch) {
    candidates.push(clean);
  }

  // Fallback: use the raw string
  if (candidates.length === 0) {
    candidates.push(clean);
  }

  return [...new Set(candidates)];
}

/**
 * Parse raw OpenSky state array into a typed object.
 */
function parseStateVector(state: (string | number | boolean | null)[]): OpenSkyStateVector {
  return {
    icao24: state[0] as string,
    callsign: state[1] as string | null,
    origin_country: state[2] as string,
    time_position: state[3] as number | null,
    last_contact: state[4] as number,
    longitude: state[5] as number | null,
    latitude: state[6] as number | null,
    baro_altitude: state[7] as number | null,
    on_ground: state[8] as boolean,
    velocity: state[9] as number | null,
    true_track: state[10] as number | null,
    vertical_rate: state[11] as number | null,
    sensors: state[12] as number[] | null,
    geo_altitude: state[13] as number | null,
    squawk: state[14] as string | null,
    spi: state[15] as boolean,
    position_source: state[16] as number,
  };
}

/**
 * Map an OpenSky state vector to FlightTelemetry.
 * Since OpenSky doesn't provide route/origin/destination info, we fill those as best we can.
 */
export function mapStateToTelemetry(
  sv: OpenSkyStateVector,
  flight: string,
  fetchedAt: string,
): FlightTelemetry {
  const lat = sv.latitude ?? 0;
  const lon = sv.longitude ?? 0;
  const altMeters = sv.baro_altitude ?? sv.geo_altitude ?? 0;
  const altFeet = Math.round(altMeters * METERS_TO_FEET);
  const speedKnots = sv.velocity ? Math.round(sv.velocity * MPS_TO_KNOTS) : 0;

  let status: FlightTelemetry['status'] = 'unknown';
  if (sv.on_ground) {
    status = altFeet < 100 ? 'landed' : 'scheduled';
  } else if (altFeet > 1000) {
    status = 'enroute';
  }

  // Without route info, we can only estimate progress from altitude/on_ground
  const progress = sv.on_ground ? (status === 'landed' ? 1.0 : 0.0) : 0.5;

  return {
    flight,
    status,
    from: { code: '???', lat: 0, lon: 0 },
    to: { code: '???', lat: 0, lon: 0 },
    position: { lat, lon },
    altitude: altFeet,
    speed: speedKnots,
    progress,
    eta: '', // cannot compute without route data
    fetchedAt,
  };
}

/**
 * The full /states/all payload can be ~5MB and 10K+ aircraft. Cache it briefly so
 * concurrent track() calls share one fetch. 30s matches OpenSky's anonymous refresh window.
 */
const STATE_FEED_TTL = 30_000;

interface FeedCache {
  fetchedAt: number;
  body: OpenSkyResponse;
}

export class OpenSkyProvider implements FlightTrackerProvider {
  private readonly baseUrl: string;
  private readonly authHeader?: string;
  private feedCache: FeedCache | null = null;
  private feedInflight: Promise<OpenSkyResponse> | null = null;

  constructor(opts: OpenSkyProviderOptions = {}) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    if (opts.username && opts.password) {
      this.authHeader =
        'Basic ' + btoa(`${opts.username}:${opts.password}`);
    }
  }

  /** Fetch the global state feed (cached up to STATE_FEED_TTL). */
  private async getFeed(): Promise<OpenSkyResponse> {
    if (this.feedCache && Date.now() - this.feedCache.fetchedAt < STATE_FEED_TTL) {
      return this.feedCache.body;
    }
    if (this.feedInflight) return this.feedInflight;

    const url = `${this.baseUrl}/states/all`;
    const headers: Record<string, string> = {};
    if (this.authHeader) headers['Authorization'] = this.authHeader;

    this.feedInflight = (async () => {
      try {
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`);
        const body = (await res.json()) as OpenSkyResponse;
        this.feedCache = { fetchedAt: Date.now(), body };
        return body;
      } finally {
        this.feedInflight = null;
      }
    })();
    return this.feedInflight;
  }

  async track(flight: string): Promise<FlightTelemetry> {
    const candidates = flightToCallsigns(flight).map((c) => c.trim().toUpperCase());
    if (!candidates.length) {
      throw new Error(`OpenSky: cannot derive callsigns for "${flight}"`);
    }
    const fetchedAt = new Date().toISOString();
    const body = await this.getFeed();
    if (!body.states || body.states.length === 0) {
      throw new Error(`OpenSky: empty feed for "${flight}"`);
    }

    // OpenSky state-vector index 1 is the callsign (padded to 8 chars). Trim + uppercase to match.
    const wanted = new Set(candidates);
    for (const state of body.states) {
      const cs = (state[1] as string | null)?.trim().toUpperCase();
      if (cs && wanted.has(cs)) {
        return mapStateToTelemetry(parseStateVector(state), flight, fetchedAt);
      }
    }

    throw new Error(`OpenSky: no state vector matched callsigns [${candidates.join(', ')}] for "${flight}"`);
  }
}
