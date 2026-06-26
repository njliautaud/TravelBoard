/**
 * TravelpayoutsProvider — real flight pricing via Travelpayouts/Aviasales Data API.
 * FREE tier (affiliate signup), cached pricing data for all major routes.
 *
 * Key endpoints:
 * - /v1/prices/cheap — cheapest tickets for a route (cached data)
 * - /v2/prices/month-matrix — cheapest per day for a month
 * - /v2/prices/latest — latest found prices
 * - /v1/city-directions — popular routes from origin
 *
 * Auth: X-Access-Token header with API token from dashboard.
 *
 * Implements the sacred FlightProvider interface.
 */

import type { FlightProvider, FareQuote, GetCheapestOptions } from './types';
import { DESTINATIONS, findDestination } from '../data/destinations';
import { findAirport } from '../data/airports';
import { resolveMetro } from '../data/metros';

export interface TravelpayoutsProviderOptions {
  apiToken: string;
  baseUrl?: string;
  /** Currency code (default: USD) */
  currency?: string;
}


interface TPLatestResponse {
  success?: boolean;
  data: Array<{
    origin: string;
    destination: string;
    value: number;
    depart_date: string;
    return_date: string;
    number_of_changes: number;
    distance: number;
    actual: boolean;
    show_to_affiliates: boolean;
    trip_class: number;
    gate: string;
    found_at: string;
    duration: number;
  }>;
  error?: string;
}

const DEFAULT_BASE_URL = 'https://api.travelpayouts.com';
const KM_TO_MILES = 0.621371;

/**
 * Build a Kiwi.com / Aviasales booking deep-link for the fare.
 */
function buildDeepLink(origin: string, dest: string, departDate: string): string {
  const d = departDate.split('T')[0] ?? departDate;
  return `https://www.aviasales.com/search/${origin}${d.replace(/-/g, '')}${dest}1?adults=1`;
}

/**
 * Map a TP price result to FareQuote.
 */
function mapToFareQuote(
  origin: string,
  destCode: string,
  price: number,
  distance: number,
  departureAt: string,
  returnAt: string | undefined,
  gate: string | undefined,
  fetchedAt: string,
  transfers?: number | null,
  durationMin?: number | null,
): FareQuote | null {
  const dest = findDestination(destCode);
  let ap = dest ? null : findAirport(destCode);
  // HC 2026-06-04 #AIRPORT-COVERAGE: fall through metro->primary-airport so NYC/LON/MKC etc.
  // get real coords + city/country instead of lat=0/lon=0 (was the equator-pin bug).
  if (!dest && !ap) {
    const metro = resolveMetro(destCode);
    if (metro) ap = findAirport(metro) ?? null;
  }
  return {
    flyFrom: origin,
    flyTo: destCode,
    cityTo: dest?.city ?? ap?.city ?? destCode,
    countryTo: dest?.country ?? ap?.country ?? '',
    lat: dest?.lat ?? ap?.lat ?? 0,
    lon: dest?.lon ?? ap?.lon ?? 0,
    price,
    distance: Math.round(distance * KM_TO_MILES),
    themes: dest?.themes ?? [],
    deepLink: buildDeepLink(origin, destCode, departureAt),
    fetchedAt,
    departDate: departureAt?.split('T')[0],
    returnDate: returnAt?.split('T')[0],
    gate,
    transfers: transfers ?? null,
    // HC #606: TP v2 `duration` = ROUND-TRIP total travel minutes (verified live).
    durationMin: durationMin ?? null,
    source: 'tp-latest',
    // HC #618 R4: TP v2 returns round-trip totals (departureAt + returnAt + duration).
    tripType: 'round-trip',
  };
}

export class TravelpayoutsProvider implements FlightProvider {
  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly currency: string;

  constructor(opts: TravelpayoutsProviderOptions) {
    if (!opts.apiToken) {
      throw new Error(
        'TravelpayoutsProvider requires TRAVELPAYOUTS_TOKEN (Golden rule 5: no hardcoded keys).',
      );
    }
    this.apiToken = opts.apiToken;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.currency = opts.currency ?? 'USD';
  }

  async getCheapest(opts: GetCheapestOptions): Promise<FareQuote[]> {
    const { origin, month } = opts;
    const fetchedAt = new Date().toISOString();
    const year = new Date().getFullYear();
    const m = month + 1; // 0-indexed → 1-indexed
    const monthStr = `${year}-${String(m).padStart(2, '0')}`;

    // Strategy: use /v2/prices/latest which returns cheapest recently-found prices
    // This is cached data from Aviasales, so it's fast and doesn't count against search API limits.
    const url = `${this.baseUrl}/v2/prices/latest?currency=${this.currency}&origin=${origin.code}&period_type=month&beginning_of_period=${monthStr}-01&limit=100&sorting=price&show_to_affiliates=true&trip_class=0`;

    const res = await fetch(url, {
      headers: {
        'X-Access-Token': this.apiToken,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Travelpayouts API error: ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as TPLatestResponse;

    if (body.error) {
      throw new Error(`Travelpayouts error: ${body.error ?? 'unknown'}`);
    }

    // Deduplicate: keep cheapest per destination
    const byDest = new Map<string, FareQuote>();
    for (const item of body.data) {
      const existing = byDest.get(item.destination);
      if (!existing || item.value < existing.price) {
        const quote = mapToFareQuote(
          origin.code,
          item.destination,
          item.value,
          item.distance,
          item.depart_date,
          item.return_date,
          item.gate,
          fetchedAt,
          Number.isFinite(item.number_of_changes) ? item.number_of_changes : null,
          Number.isFinite(item.duration) && item.duration > 0 ? item.duration : null,
        );
        if (quote) byDest.set(item.destination, quote);
      }
    }

    let quotes = [...byDest.values()];

    // Apply filters
    if (opts.regions?.length) {
      const regionSet = new Set(opts.regions);
      const destsByRegion = DESTINATIONS.filter((d) => regionSet.has(d.region)).map((d) => d.code);
      const codeSet = new Set(destsByRegion);
      quotes = quotes.filter((q) => codeSet.has(q.flyTo));
    }
    if (opts.themes?.length) {
      const themeSet = new Set(opts.themes);
      quotes = quotes.filter((q) => q.themes.some((t) => themeSet.has(t)));
    }
    if (opts.budget != null) {
      quotes = quotes.filter((q) => q.price <= opts.budget!);
    }

    return quotes.sort((a, b) => a.price - b.price);
  }
}
