/**
 * MockTequilaProvider — the default, offline, zero-key fare provider.
 * Implements the sacred FlightProvider interface using the deterministic mock fare model so the whole
 * product is runnable with no accounts. (Golden rule 5: runs fully with zero keys.)
 */

import type { FlightProvider, FareQuote, GetCheapestOptions } from './types';
import { DESTINATIONS } from '../data/destinations';
import { estimateFare } from '../fares/model';

/** Build a working Google Flights deep-link. Fares are inspiration; always link out (Golden rule 4). */
function bookingDeepLink(origin: string, dest: string, month: number): string {
  // Google Flights explore URL — opens with origin→destination for the given month.
  // Format: /travel/flights/MCO/LIS/2026-07-01/2026-07-15
  const year = new Date().getFullYear();
  const m = month + 1; // month is 0-indexed, URL needs 1-indexed
  const mm = String(m).padStart(2, '0');
  const departDate = `${year}-${mm}-15`;
  const returnDate = `${year}-${mm}-22`;
  return `https://www.google.com/travel/flights?q=Flights+to+${dest}+from+${origin}+on+${departDate}+through+${returnDate}`;
}

export class MockTequilaProvider implements FlightProvider {
  async getCheapest(opts: GetCheapestOptions): Promise<FareQuote[]> {
    const { origin, month } = opts;
    const fetchedAt = new Date().toISOString();

    let pool = DESTINATIONS;
    if (opts.regions?.length) {
      const set = new Set(opts.regions);
      pool = pool.filter((d) => set.has(d.region));
    }
    if (opts.themes?.length) {
      const set = new Set(opts.themes);
      pool = pool.filter((d) => d.themes.some((t) => set.has(t)));
    }

    let quotes: FareQuote[] = pool
      // never return the origin itself as a destination
      .filter((d) => d.code !== origin.code)
      .map((d) => {
        const { price, distance } = estimateFare(origin, d, month);
        return {
          flyFrom: origin.code,
          flyTo: d.code,
          cityTo: d.city,
          countryTo: d.country,
          lat: d.lat,
          lon: d.lon,
          price,
          distance,
          themes: d.themes,
          deepLink: bookingDeepLink(origin.code, d.code, month),
          fetchedAt,
        };
      });

    if (opts.budget != null) {
      quotes = quotes.filter((q) => q.price <= opts.budget!);
    }

    // cheapest first — "one result per city" is already guaranteed by the dataset
    return quotes.sort((a, b) => a.price - b.price);
  }
}
