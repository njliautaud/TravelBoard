/**
 * AmadeusProvider — Amadeus Self-Service "Flight Inspiration Search".
 *
 * FLAG-GATED: requires AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET (free self-service
 * tier exists at https://developers.amadeus.com — the OWNER must sign up; we never
 * create paid/new accounts autonomously). Until keys are present this provider is
 * simply not added to the aggregate fan-out.
 *
 * Endpoint contract (verified against Amadeus self-service docs, v1, 2026):
 *   POST https://test.api.amadeus.com/v1/security/oauth2/token
 *        grant_type=client_credentials&client_id=...&client_secret=...
 *   GET  https://test.api.amadeus.com/v1/shopping/flight-destinations?origin=MCO&oneWay=false
 *        → { data: [{ destination, departureDate, returnDate, price: { total } }] }
 *
 * Production base URL is api.amadeus.com (set AMADEUS_BASE_URL). Prices are in the
 * account currency; we request no conversion and treat totals as USD for US accounts.
 *
 * Implements the sacred FlightProvider interface.
 */

import type { FlightProvider, FareQuote, GetCheapestOptions } from './types.js';
import { findDestination } from '../data/destinations.js';
import { findAirport } from '../data/airports.js';
import { resolveMetro } from '../data/metros.js';
import { haversineMiles } from '../geo.js';

export interface AmadeusProviderOptions {
  clientId: string;
  clientSecret: string;
  /** default: https://test.api.amadeus.com (self-service sandbox) */
  baseUrl?: string;
}

interface AmadeusTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface AmadeusDestinationsResponse {
  data?: Array<{
    destination: string;
    departureDate?: string;
    returnDate?: string;
    price?: { total?: string };
    links?: { flightOffers?: string };
  }>;
  errors?: Array<{ detail?: string; title?: string }>;
}

export class AmadeusProvider implements FlightProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(opts: AmadeusProviderOptions) {
    if (!opts.clientId || !opts.clientSecret) {
      throw new Error(
        'AmadeusProvider requires AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET (Golden rule 5).',
      );
    }
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.baseUrl = opts.baseUrl ?? 'https://test.api.amadeus.com';
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - 30_000) return this.token.value;
    const res = await fetch(`${this.baseUrl}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    const body = (await res.json()) as AmadeusTokenResponse;
    if (!res.ok || !body.access_token) {
      throw new Error(`Amadeus auth failed: ${body.error_description ?? res.status}`);
    }
    this.token = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 1799) * 1000,
    };
    return this.token.value;
  }

  async getCheapest(opts: GetCheapestOptions): Promise<FareQuote[]> {
    const { origin, month } = opts;
    const token = await this.getToken();
    const fetchedAt = new Date().toISOString();

    const now = new Date();
    const year = now.getUTCMonth() <= month ? now.getUTCFullYear() : now.getUTCFullYear() + 1;
    const mm = String(month + 1).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const departureDate = `${year}-${mm}-01,${year}-${mm}-${String(lastDay).padStart(2, '0')}`;

    const url = `${this.baseUrl}/v1/shopping/flight-destinations?origin=${origin.code}&oneWay=false&departureDate=${departureDate}&nonStop=false`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = (await res.json()) as AmadeusDestinationsResponse;
    if (!res.ok) {
      throw new Error(`Amadeus flight-destinations error: ${body.errors?.[0]?.detail ?? res.status}`);
    }

    const out: FareQuote[] = [];
    for (const d of body.data ?? []) {
      const price = Number(d.price?.total);
      if (!d.destination || !Number.isFinite(price) || price <= 0) continue;
      const dest = findDestination(d.destination);
      let ap = dest ? null : (findAirport(d.destination) ?? null);
      if (!dest && !ap) {
        const metro = resolveMetro(d.destination);
        if (metro) ap = findAirport(metro) ?? null;
      }
      const lat = dest?.lat ?? ap?.lat ?? 0;
      const lon = dest?.lon ?? ap?.lon ?? 0;
      out.push({
        flyFrom: origin.code,
        flyTo: d.destination,
        cityTo: dest?.city ?? ap?.city ?? d.destination,
        countryTo: dest?.country ?? ap?.country ?? '',
        lat,
        lon,
        price: Math.round(price),
        distance:
          lat !== 0 || lon !== 0
            ? Math.round(haversineMiles({ lat: origin.lat, lon: origin.lon }, { lat, lon }))
            : 0,
        themes: dest?.themes ?? [],
        deepLink: `https://www.aviasales.com/?origin_iata=${origin.code}&destination_iata=${d.destination}`,
        fetchedAt,
        departDate: d.departureDate,
        returnDate: d.returnDate,
        gate: 'Amadeus',
        source: 'amadeus',
        // HC #618 R4: Amadeus flight-inspiration returns round-trip pairs.
        tripType: 'round-trip',
      });
    }

    if (opts.budget != null) return out.filter((q) => q.price <= opts.budget!);
    return out.sort((a, b) => a.price - b.price);
  }
}
