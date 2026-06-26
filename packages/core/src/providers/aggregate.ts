/**
 * AggregateProvider — the pricing-supremacy layer (HC #601).
 *
 * Fans a getCheapest() query out to EVERY configured real source in parallel
 * (Travelpayouts latest, Travelpayouts city-directions, Kiwi GraphQL, Amadeus
 * when keys exist), then merges the results into ONE canonical offer per
 * destination:
 *
 *   - dedup: the same destination quoted by N sources collapses to a single
 *     FareQuote carrying the BEST (lowest, sane) price;
 *   - attribution: `source` = winning source, `sources` = every source that
 *     independently quoted the destination, `priceBySource` = per-source price;
 *   - normalization: all sources are queried in USD, round-trip, economy;
 *     metadata (coords/themes/dates/transfers) is taken from the winning offer
 *     and backfilled from losers when the winner lacks it;
 *   - resilience: one source failing NEVER blanks the board — Promise.allSettled,
 *     and we only throw when every source fails.
 *
 * Implements the sacred FlightProvider interface, so downstream (cache, board,
 * app) cannot tell it is talking to many sources. (Golden rule 1.)
 */

import type { FlightProvider, FareQuote, GetCheapestOptions } from './types';

export interface AggregateSource {
  /** short id used for attribution, e.g. "tp-latest", "tp-directions", "kiwi", "amadeus" */
  name: string;
  provider: FlightProvider;
}

export interface AggregateProviderOptions {
  sources: AggregateSource[];
  /** per-source timeout, ms (default 25s) — a slow source must not stall the warm cycle */
  timeoutMs?: number;
  /**
   * Cross-source price sanity: if a source quotes < sanityFloorRatio × the median quote
   * for the same destination, treat it as a glitch and don't let it win (default 0.25).
   */
  sanityFloorRatio?: number;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export class AggregateProvider implements FlightProvider {
  private readonly sources: AggregateSource[];
  private readonly timeoutMs: number;
  private readonly sanityFloorRatio: number;
  /** last fan-out diagnostics — read by callers that want to log per-source health */
  lastRunStats: Array<{ source: string; ok: boolean; count: number; error?: string }> = [];

  constructor(opts: AggregateProviderOptions) {
    if (!opts.sources.length) throw new Error('AggregateProvider needs at least one source');
    this.sources = opts.sources;
    this.timeoutMs = opts.timeoutMs ?? 25_000;
    this.sanityFloorRatio = opts.sanityFloorRatio ?? 0.25;
  }

  async getCheapest(opts: GetCheapestOptions): Promise<FareQuote[]> {
    const settled = await Promise.allSettled(
      this.sources.map((s) =>
        withTimeout(s.provider.getCheapest(opts), this.timeoutMs, s.name).then((quotes) => ({
          name: s.name,
          quotes,
        })),
      ),
    );

    const perSource: Array<{ name: string; quotes: FareQuote[] }> = [];
    this.lastRunStats = [];
    const errors: string[] = [];
    settled.forEach((r, i) => {
      const name = this.sources[i]!.name;
      if (r.status === 'fulfilled') {
        perSource.push({ name, quotes: r.value.quotes });
        this.lastRunStats.push({ source: name, ok: true, count: r.value.quotes.length });
      } else {
        const msg = (r.reason as Error)?.message ?? String(r.reason);
        errors.push(`${name}: ${msg}`);
        this.lastRunStats.push({ source: name, ok: false, count: 0, error: msg });
      }
    });

    if (perSource.length === 0) {
      throw new Error(`all aggregate sources failed — ${errors.join(' | ')}`);
    }

    // bucket all quotes per destination
    const buckets = new Map<string, Array<FareQuote & { _src: string }>>();
    for (const { name, quotes } of perSource) {
      for (const q of quotes) {
        if (!q.flyTo || !Number.isFinite(q.price) || q.price <= 0) continue;
        const key = q.flyTo.toUpperCase();
        const arr = buckets.get(key) ?? [];
        arr.push({ ...q, _src: q.source ?? name });
        buckets.set(key, arr);
      }
    }

    const merged: FareQuote[] = [];
    for (const candidates of buckets.values()) {
      // cross-source glitch filter: a price absurdly below the median for the SAME destination
      // is a data error, not a deal — never let it become the canonical price.
      const med = median(candidates.map((c) => c.price));
      const sane = candidates.filter((c) => c.price >= med * this.sanityFloorRatio);
      const pool = sane.length ? sane : candidates;
      const winner = pool.reduce((a, b) => (b.price < a.price ? b : a));

      const sources = [...new Set(candidates.map((c) => c._src))];
      const priceBySource: Record<string, number> = {};
      for (const c of candidates) {
        const cur = priceBySource[c._src];
        if (cur == null || c.price < cur) priceBySource[c._src] = c.price;
      }

      // metadata backfill from richer losers (coords, themes, dates, transfers)
      const donor = (pick: (c: FareQuote) => boolean) => candidates.find(pick);
      const coordDonor = winner.lat === 0 && winner.lon === 0 ? donor((c) => c.lat !== 0 || c.lon !== 0) : undefined;
      const themeDonor = winner.themes.length === 0 ? donor((c) => c.themes.length > 0) : undefined;
      const dateDonor = !winner.departDate ? donor((c) => !!c.departDate) : undefined;
      const transferDonor = winner.transfers == null ? donor((c) => c.transfers != null) : undefined;

      // HC #618 R4 — preserve tripType from the winning quote. Every cash source
      // we currently aggregate (Kiwi anywhere, Tequila round, TP round) prices
      // round-trip itineraries; if a future source ever ships one-way, the
      // winning quote's `tripType` carries through honestly. Defaults to
      // 'round-trip' only when ALL contributing sources agree it's RT (i.e. the
      // winner is RT and no one disagrees) — never silently relabel one-ways.
      const winnerTrip = winner.tripType
        ?? (candidates.every((c) => c.tripType === undefined || c.tripType === 'round-trip')
          ? 'round-trip'
          : undefined);
      merged.push({
        ...winner,
        lat: coordDonor?.lat ?? winner.lat,
        lon: coordDonor?.lon ?? winner.lon,
        themes: themeDonor?.themes ?? winner.themes,
        departDate: winner.departDate ?? dateDonor?.departDate,
        returnDate: winner.returnDate ?? dateDonor?.returnDate,
        transfers: winner.transfers ?? transferDonor?.transfers ?? null,
        // HC #606: durationMin is deliberately NOT donor-backfilled — a travel time only
        // describes the itinerary it was priced with; borrowing one would fabricate data.
        durationMin: winner.durationMin ?? null,
        tripType: winnerTrip,
        source: winner.source ?? (winner as FareQuote & { _src: string })._src,
        sources,
        priceBySource,
      });
    }

    // strip the private tag
    for (const m of merged as Array<FareQuote & { _src?: string }>) delete m._src;

    return merged.sort((a, b) => a.price - b.price);
  }
}
