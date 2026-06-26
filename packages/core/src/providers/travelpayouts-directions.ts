/**
 * TravelpayoutsDirectionsProvider — second independent Travelpayouts corpus.
 *
 * Endpoint: GET /v1/city-directions?origin=XXX&currency=usd
 * Returns the ~100 most popular directions from the origin city with the
 * cheapest found round-trip price, airline, flight number and TRANSFERS count
 * (which /v2/prices/latest does not always carry per-destination).
 *
 * This is a deliberately different cache inside Travelpayouts than
 * /v2/prices/latest, so aggregating both widens coverage AND lets the
 * aggregator cross-confirm prices between two corpora.
 *
 * Auth: same TRAVELPAYOUTS_TOKEN. Implements the sacred FlightProvider interface.
 */

import type { FlightProvider, FareQuote, GetCheapestOptions } from './types';
import { findDestination } from '../data/destinations';
import { findAirport } from '../data/airports';
import { resolveMetro } from '../data/metros';
import { haversineMiles } from '../geo';

const DEFAULT_BASE_URL = 'https://api.travelpayouts.com';

export interface TravelpayoutsDirectionsProviderOptions {
  apiToken: string;
  baseUrl?: string;
  currency?: string;
}

interface TPDirectionsResponse {
  success?: boolean;
  error?: string;
  data?: Record<
    string,
    {
      origin: string;
      destination: string;
      price: number;
      airline: string;
      flight_number: number;
      departure_at: string;
      return_at: string;
      transfers: number;
      expires_at: string;
    }
  >;
}

function isoDate(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
}

export class TravelpayoutsDirectionsProvider implements FlightProvider {
  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly currency: string;

  constructor(opts: TravelpayoutsDirectionsProviderOptions) {
    if (!opts.apiToken) {
      throw new Error(
        'TravelpayoutsDirectionsProvider requires TRAVELPAYOUTS_TOKEN (Golden rule 5: no hardcoded keys).',
      );
    }
    this.apiToken = opts.apiToken;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.currency = opts.currency ?? 'usd';
  }

  async getCheapest(opts: GetCheapestOptions): Promise<FareQuote[]> {
    const { origin } = opts;
    const fetchedAt = new Date().toISOString();
    const url = `${this.baseUrl}/v1/city-directions?origin=${origin.code}&currency=${this.currency}`;

    const res = await fetch(url, {
      headers: { 'X-Access-Token': this.apiToken, Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Travelpayouts city-directions error: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as TPDirectionsResponse;
    if (body.error) throw new Error(`Travelpayouts city-directions error: ${body.error}`);

    const out: FareQuote[] = [];
    for (const [destCode, d] of Object.entries(body.data ?? {})) {
      if (!d || !Number.isFinite(d.price) || d.price <= 0) continue;
      const dest = findDestination(destCode);
      let ap = dest ? null : (findAirport(destCode) ?? null);
      if (!dest && !ap) {
        const metro = resolveMetro(destCode);
        if (metro) ap = findAirport(metro) ?? null;
      }
      const lat = dest?.lat ?? ap?.lat ?? 0;
      const lon = dest?.lon ?? ap?.lon ?? 0;
      const departDate = isoDate(d.departure_at);
      out.push({
        flyFrom: origin.code,
        flyTo: destCode,
        cityTo: dest?.city ?? ap?.city ?? destCode,
        countryTo: dest?.country ?? ap?.country ?? '',
        lat,
        lon,
        price: Math.round(d.price),
        distance:
          lat !== 0 || lon !== 0
            ? Math.round(haversineMiles({ lat: origin.lat, lon: origin.lon }, { lat, lon }))
            : 0,
        themes: dest?.themes ?? [],
        deepLink: departDate
          ? `https://www.aviasales.com/search/${origin.code}${departDate.replace(/-/g, '')}${destCode}1?adults=1`
          : `https://www.aviasales.com/?origin_iata=${origin.code}&destination_iata=${destCode}`,
        fetchedAt,
        departDate,
        returnDate: isoDate(d.return_at),
        gate: 'Aviasales',
        transfers: Number.isFinite(d.transfers) ? d.transfers : null,
        source: 'tp-directions',
        // HC #618 R4: directions endpoint returns both departure_at + return_at.
        tripType: 'round-trip',
      });
    }

    // month filter: this endpoint is "popular directions, any date" — keep quotes departing in
    // the requested month when a date is present; keep undated quotes too (still real prices).
    const filtered = out.filter((q) => {
      if (!q.departDate) return true;
      const m = Number(q.departDate.slice(5, 7)) - 1;
      return m === opts.month;
    });
    // If the month filter starves the result set, fall back to the full corpus rather than
    // returning nothing — coverage beats strict month matching for an inspiration surface.
    const quotes = filtered.length >= 5 ? filtered : out;

    if (opts.budget != null) return quotes.filter((q) => q.price <= opts.budget!);
    return quotes.sort((a, b) => a.price - b.price);
  }
}
