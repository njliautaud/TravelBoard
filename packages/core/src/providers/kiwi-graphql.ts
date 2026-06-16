/**
 * KiwiGraphQLProvider — REAL flight pricing via Kiwi.com's public GraphQL API.
 *
 * NO API KEY REQUIRED. This uses the same public endpoint that powers kiwi.com's
 * own "Explore anywhere" feature. Returns real round-trip prices, sorted cheapest-first,
 * one result per destination city.
 *
 * Endpoint: POST https://api.skypicker.com/umbrella/v2/graphql
 * Auth: None (public)
 * Rate limiting: Be respectful — cache aggressively (the board's 12h cache handles this).
 *
 * Implements the sacred FlightProvider interface. Swappable via FLIGHT_PROVIDER=kiwi env var.
 */

import type { FlightProvider, FareQuote, GetCheapestOptions } from './types.js';
import { DESTINATIONS, findDestination } from '../data/destinations.js';
import { VACATION_CODES } from '../data/vacations.js';
import { defaultProviderNightsWindow, clampToConsumerCap } from '../fares/duration-bands.js';

const GRAPHQL_URL = 'https://api.skypicker.com/umbrella/v2/graphql';

/**
 * HC #615 — second query variant with an explicit destination set. The
 * price-sorted "anywhere" query structurally returns short domestic hops from a
 * US origin; this one quotes the curated worldwide vacation list (Europe, Asia,
 * Caribbean, South America, Africa, Oceania) so real international vacations
 * always reach the board. Identical response shape.
 */
const RETURN_ONE_PER_CITY_DEST_QUERY = `
query CheapestFaresTo(
  $sourceIds: [ID!],
  $destIds: [ID!],
  $outStart: DateTime!,
  $outEnd: DateTime!,
  $inStart: DateTime!,
  $inEnd: DateTime!,
  $nightsMin: Int!,
  $nightsMax: Int!,
  $limit: Int!,
  $currency: String!,
  $maxPrice: Int
) {
  returnOnePerCityItineraries(
    search: {
      itinerary: {
        source: { ids: $sourceIds }
        destination: { ids: $destIds }
        outboundDepartureDate: { start: $outStart, end: $outEnd }
        inboundDepartureDate: { start: $inStart, end: $inEnd }
        nightsCount: { start: $nightsMin, end: $nightsMax }
      }
      passengers: { adults: 1 }
    }
    filter: {
      limit: $limit
      price: { start: 0, end: $maxPrice }
    }
    options: { currency: $currency, sortBy: PRICE, locale: "en", partner: "skypicker" }
  ) {
    ... on OnePerCityItineraries {
      itineraries {
        ... on ReturnOnePerCityItinerary {
          price { amount formattedValue }
          destination {
            station {
              code
              name
              city { name country { name code } }
              gps { lat lng }
            }
          }
          source {
            station { code }
          }
          departureDate
          returnDate
        }
      }
    }
    ... on AppError { message }
  }
}
`;

/** The GraphQL query for "cheapest round-trip to anywhere, one per city". */
const RETURN_ONE_PER_CITY_QUERY = `
query CheapestFares(
  $sourceIds: [ID!],
  $outStart: DateTime!,
  $outEnd: DateTime!,
  $inStart: DateTime!,
  $inEnd: DateTime!,
  $nightsMin: Int!,
  $nightsMax: Int!,
  $limit: Int!,
  $currency: String!,
  $maxPrice: Int
) {
  returnOnePerCityItineraries(
    search: {
      itinerary: {
        source: { ids: $sourceIds }
        outboundDepartureDate: { start: $outStart, end: $outEnd }
        inboundDepartureDate: { start: $inStart, end: $inEnd }
        nightsCount: { start: $nightsMin, end: $nightsMax }
      }
      passengers: { adults: 1 }
    }
    filter: {
      limit: $limit
      price: { start: 0, end: $maxPrice }
    }
    options: { currency: $currency, sortBy: PRICE, locale: "en", partner: "skypicker" }
  ) {
    ... on OnePerCityItineraries {
      itineraries {
        ... on ReturnOnePerCityItinerary {
          price { amount formattedValue }
          destination {
            station {
              code
              name
              city { name country { name code } }
              gps { lat lng }
            }
          }
          source {
            station { code }
          }
          departureDate
          returnDate
        }
      }
    }
    ... on AppError { message }
  }
}
`;

/** Shape of a single itinerary from the GraphQL response. */
interface KiwiItinerary {
  price: { amount: string; formattedValue: string };
  destination: {
    station: {
      code: string;
      name: string;
      city: { name: string; country: { name: string; code: string } };
      gps: { lat: number; lng: number };
    };
  };
  source: { station: { code: string } };
  departureDate: string;
  returnDate: string;
}

interface KiwiGraphQLResponse {
  data: {
    returnOnePerCityItineraries:
      | { itineraries: KiwiItinerary[] }
      | { message: string };
  };
  errors?: Array<{ message: string }>;
}

/**
 * Build a Kiwi.com booking deep-link for a specific route + dates.
 * Links to the actual Kiwi search results page so users can book.
 */
function buildDeepLink(origin: string, dest: string, departDate: string, returnDate: string): string {
  const dep = departDate.split('T')[0] ?? departDate;
  const ret = returnDate.split('T')[0] ?? returnDate;
  return `https://www.kiwi.com/en/search/results/${origin}/${dest}/${dep}/${ret}`;
}

/**
 * Haversine distance in miles between two lat/lon points.
 * Inlined to avoid importing geo.ts (which may have different GeoPoint shape).
 */
function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface KiwiGraphQLProviderOptions {
  /** Override the GraphQL endpoint (for testing). */
  baseUrl?: string;
  /** Max results to request from the API (default 200). */
  limit?: number;
  /**
   * HC #615 — also quote the curated worldwide vacation destination list in a
   * second parallel query (default true). The price-sorted "anywhere" query
   * alone skews domestic from a US origin.
   */
  includeVacationSpots?: boolean;
}

export class KiwiGraphQLProvider implements FlightProvider {
  private readonly url: string;
  private readonly limit: number;
  private readonly includeVacationSpots: boolean;

  constructor(opts?: KiwiGraphQLProviderOptions) {
    this.url = opts?.baseUrl ?? GRAPHQL_URL;
    this.limit = opts?.limit ?? 200;
    this.includeVacationSpots = opts?.includeVacationSpots ?? true;
  }

  /** POST one GraphQL query and return its itineraries (throws on any error). */
  private async runQuery(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<KiwiItinerary[]> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Kiwi GraphQL ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as KiwiGraphQLResponse;

    // Check for GraphQL-level errors
    if (json.errors?.length) {
      throw new Error(`Kiwi GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`);
    }

    const result = json.data.returnOnePerCityItineraries;
    if ('message' in result) {
      throw new Error(`Kiwi AppError: ${(result as { message: string }).message}`);
    }

    return (result as { itineraries: KiwiItinerary[] }).itineraries;
  }

  async getCheapest(opts: GetCheapestOptions): Promise<FareQuote[]> {
    const { origin, month, budget } = opts;
    const fetchedAt = new Date().toISOString();

    // Build the date range for the requested month.
    const now = new Date();
    const year = now.getFullYear();
    const targetYear = month < now.getMonth() ? year + 1 : year;

    const firstDay = new Date(targetYear, month, 1);
    const lastDay = new Date(targetYear, month + 1, 0);
    // Return window: allow returning up to 2 weeks after end of month.
    const returnEnd = new Date(targetYear, month + 1, 14);

    const variables = {
      sourceIds: [`Station:airport:${origin.code}`],
      outStart: firstDay.toISOString().split('.')[0],
      outEnd: lastDay.toISOString().split('.')[0],
      inStart: new Date(targetYear, month, 4).toISOString().split('.')[0],
      inEnd: returnEnd.toISOString().split('.')[0],
      // HC #619 — distance-banded duration realism. Provider query is "anywhere",
      // so we use the conservative default window (3–14n) clamped to the consumer
      // hard cap (~30n). Per-destination band tightening happens client-side via
      // duration-bands.ts when the destination distance is known.
      nightsMin: clampToConsumerCap(defaultProviderNightsWindow().min, defaultProviderNightsWindow().max).min,
      nightsMax: clampToConsumerCap(defaultProviderNightsWindow().min, defaultProviderNightsWindow().max).max,
      limit: this.limit,
      currency: 'usd',
      maxPrice: budget != null ? Math.round(budget) : 5000,
    };

    // HC #615: two parallel queries — "cheapest anywhere" (coverage) + curated
    // worldwide vacation destinations (international reach). The vacation query
    // failing must never blank the board: it degrades to anywhere-only.
    const anywhereP = this.runQuery(RETURN_ONE_PER_CITY_QUERY, variables);
    const vacationsP = this.includeVacationSpots
      ? this.runQuery(RETURN_ONE_PER_CITY_DEST_QUERY, {
          ...variables,
          destIds: VACATION_CODES.filter((c) => c !== origin.code).map(
            (c) => `Station:airport:${c}`,
          ),
          // wider price ceiling: an $1,800 round trip to Bali can still be a deal
          maxPrice: budget != null ? Math.round(budget) : 5000,
          limit: VACATION_CODES.length,
        }).catch(() => [] as KiwiItinerary[])
      : Promise.resolve([] as KiwiItinerary[]);

    const [anywhere, vacations] = await Promise.all([anywhereP, vacationsP]);

    // Merge: keep the cheapest itinerary per destination station.
    const byDest = new Map<string, KiwiItinerary>();
    for (const it of [...anywhere, ...vacations]) {
      const code = it.destination?.station?.code;
      if (!code || !it.price?.amount) continue;
      const existing = byDest.get(code);
      if (!existing || parseFloat(it.price.amount) < parseFloat(existing.price.amount)) {
        byDest.set(code, it);
      }
    }
    const itineraries = [...byDest.values()];

    let quotes: FareQuote[] = itineraries
      .filter((it) => it.destination?.station?.code && it.price?.amount)
      .map((it) => {
        const station = it.destination.station;
        const city = station.city;
        const price = parseFloat(it.price.amount);
        const destCode = station.code;

        // Use GPS from the API response; enrich with our curated dataset for themes.
        const curated = findDestination(destCode);
        const lat = station.gps?.lat ?? curated?.lat ?? 0;
        const lon = station.gps?.lng ?? curated?.lon ?? 0;

        const dist = distanceMiles(origin.lat, origin.lon, lat, lon);

        return {
          flyFrom: origin.code,
          flyTo: destCode,
          cityTo: city?.name ?? curated?.city ?? destCode,
          countryTo: city?.country?.name ?? curated?.country ?? '',
          lat,
          lon,
          price,
          distance: Math.round(dist),
          themes: curated?.themes ?? [],
          deepLink: buildDeepLink(origin.code, destCode, it.departureDate, it.returnDate),
          fetchedAt,
          departDate: it.departureDate?.slice(0, 10),
          returnDate: it.returnDate?.slice(0, 10),
          gate: 'Kiwi.com',
          source: 'kiwi',
          // HC #618 R4: Kiwi prices outbound + return as a single round-trip itinerary.
          tripType: 'round-trip' as const,
        };
      })
      // Filter out invalid prices
      .filter((q) => q.price > 0 && Number.isFinite(q.price));

    // Apply theme/region filters client-side (API doesn't support these).
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

    // Budget filter (defense-in-depth — API also filters by maxPrice).
    if (budget != null) {
      quotes = quotes.filter((q) => q.price <= budget);
    }

    return quotes.sort((a, b) => a.price - b.price);
  }
}
