/**
 * TequilaProvider — the LIVE Kiwi Tequila adapter. Same sacred interface as the mock.
 *
 * API contract verified 2026-06-02 against current Kiwi Tequila docs:
 * - Endpoint: GET https://tequila-api.kiwi.com/v2/search
 * - Auth: header `apikey: <key>`
 * - "Anywhere from origin": set fly_from, omit fly_to (or leave empty)
 * - one_for_city=1 yields one cheapest result per destination city
 * - Response: { data: [{ flyFrom, flyTo, cityTo, countryTo: {code,name}, price, deep_link, distance, ... }] }
 *
 * See docs/FLIGHT_DATA.md for the full verified contract.
 */

import type { FlightProvider, FareQuote, GetCheapestOptions } from './types';
import { DESTINATIONS, findDestination } from '../data/destinations';

/** Raw shape of one result in the Tequila /v2/search response `data` array. */
export interface TequilaSearchResult {
  flyFrom: string;
  flyTo: string;
  cityFrom: string;
  cityTo: string;
  countryFrom: { code: string; name: string };
  countryTo: { code: string; name: string };
  price: number;
  /** Great-circle distance in km */
  distance: number;
  deep_link: string;
  /** Nested route segments — we don't need these for FareQuote */
  route: unknown[];
  [key: string]: unknown;
}

export interface TequilaSearchResponse {
  search_id: string;
  data: TequilaSearchResult[];
  currency: string;
  _results: number;
}

export interface TequilaProviderOptions {
  apiKey: string;
  /** override base URL if the contract moves */
  baseUrl?: string;
}

const KM_TO_MILES = 0.621371;
const DEFAULT_BASE_URL = 'https://tequila-api.kiwi.com';

/**
 * Map a single Tequila search result into a FareQuote (the sacred interface).
 * Exported for unit-testing with a sample payload.
 */
export function mapResultToFareQuote(r: TequilaSearchResult, fetchedAt: string): FareQuote {
  // Try to match the destination IATA to our curated dataset for lat/lon + themes.
  const dest = findDestination(r.flyTo);

  return {
    flyFrom: r.flyFrom,
    flyTo: r.flyTo,
    cityTo: r.cityTo,
    countryTo: r.countryTo.name,
    lat: dest?.lat ?? 0,
    lon: dest?.lon ?? 0,
    price: r.price,
    distance: Math.round(r.distance * KM_TO_MILES),
    themes: dest?.themes ?? [],
    deepLink: r.deep_link,
    fetchedAt,
    // HC #618 R4: Tequila /v2/search?flight_type=round prices outbound+inbound
    // as one itinerary — the FareQuote price IS the round-trip total.
    tripType: 'round-trip' as const,
  };
}

export class TequilaProvider implements FlightProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: TequilaProviderOptions) {
    if (!opts.apiKey) {
      throw new Error('TequilaProvider requires TEQUILA_API_KEY (Golden rule 5: no hardcoded keys).');
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  }

  async getCheapest(opts: GetCheapestOptions): Promise<FareQuote[]> {
    const fetchedAt = new Date().toISOString();
    const { origin, month, budget } = opts;

    // Build the date range for the requested month: 1st to last day.
    const year = new Date().getFullYear();
    // If month is in the past for the current year, use next year.
    const now = new Date();
    const targetYear = month < now.getMonth() ? year + 1 : year;
    const firstDay = new Date(targetYear, month, 1);
    const lastDay = new Date(targetYear, month + 1, 0);

    const dateFrom = formatDate(firstDay);
    const dateTo = formatDate(lastDay);

    const params = new URLSearchParams({
      fly_from: origin.code,
      // fly_to omitted = "anywhere"
      date_from: dateFrom,
      date_to: dateTo,
      return_from: dateFrom,
      return_to: dateTo,
      flight_type: 'round',
      one_for_city: '1',
      curr: 'USD',
      // HC #619 — distance-banded duration realism (consumer hard cap ~30n).
      nights_in_dst_from: '3',
      nights_in_dst_to: '14',
      limit: '200',
      sort: 'price',
      asc: '1',
    });

    if (budget != null) {
      params.set('price_to', String(Math.round(budget)));
    }

    const url = `${this.baseUrl}/v2/search?${params.toString()}`;

    const res = await fetch(url, {
      headers: { apikey: this.apiKey },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Tequila API ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as TequilaSearchResponse;

    let quotes = json.data.map((r) => mapResultToFareQuote(r, fetchedAt));

    // Apply theme/region filters if provided — the API doesn't support these natively,
    // so we filter client-side against our curated destination dataset.
    if (opts.themes?.length) {
      const themeSet = new Set(opts.themes);
      quotes = quotes.filter((q) => q.themes.some((t) => themeSet.has(t)));
    }

    if (opts.regions?.length) {
      const regionSet = new Set(opts.regions);
      const codesInRegions = new Set(
        DESTINATIONS.filter((d) => regionSet.has(d.region)).map((d) => d.code),
      );
      quotes = quotes.filter((q) => codesInRegions.has(q.flyTo));
    }

    // cheapest first, one per city already guaranteed by one_for_city=1
    return quotes.sort((a, b) => a.price - b.price);
  }
}

/** Format a Date as dd/mm/yyyy (Tequila's required format). */
function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
