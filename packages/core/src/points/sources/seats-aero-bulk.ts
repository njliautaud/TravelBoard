/**
 * seats.aero Partner API BULK availability adapter (HC #617).
 *
 * The cached-search adapter (seats-aero.ts) probes ~10 specific routes from the
 * home origin. That verifies awards on deals we ALREADY have — it never
 * DISCOVERS deals. This adapter uses the Partner API's bulk availability
 * endpoint instead:
 *
 *   GET /partnerapi/availability?source=<program>&origin_region=...&destination_region=...
 *       &start_date=...&end_date=...&take=1000&order_by=lowest_mileage
 *
 * ONE request per (program, destination region) pull returns up to 1000 cached
 * availability records across that slice of the program's route network (shape
 * + region/date filters verified live 2026-06-12: data[].Route{OriginAirport,
 * OriginRegion,DestinationAirport,DestinationRegion,Distance}, Date,
 * {Y,W,J,F}Available, *MileageCostRaw, *TotalTaxesRaw cents, *AirlinesRaw,
 * *RemainingSeatsRaw, TaxesCurrency. hasMore/cursor pagination is deliberately
 * NOT followed — one page per pull keeps the refresh at len(pulls) calls).
 *
 * QUOTA MATH (binding — the Pro key budget is ~40 upstream calls/day):
 *   default 8 pulls, refreshed every 12h = 16 calls/day. The route-probe
 *   adapter was simultaneously moved to a 12h TTL (20/day), so the combined
 *   worst case is ~36/day. UI traffic only ever reads the SourceRunner cache.
 *
 * SECURITY: identical posture to seats-aero.ts — the key is injected by the
 *   API process, sent only to seats.aero, and never appears in returned
 *   payloads or error messages.
 *
 * HONESTY: records here are VERIFIED award space (seats.aero's own cache of
 *   real award searches). We trust the FILTERED *Available flags (not *Raw)
 *   so dynamically-priced junk awards never become "deals".
 */

import type { PointsSourceAdapter } from '../types.js';

/** One route+date worth of verified bulk availability (all four cabins). */
export interface BulkAwardRecord {
  origin: string;
  dest: string;
  originRegion: string;
  destRegion: string;
  /** great-circle route distance, statute miles (seats.aero Route.Distance) */
  distanceMi: number;
  /** mileage program key (seats.aero Source, e.g. "aeroplan") */
  source: string;
  /** yyyy-mm-dd departure date the space was seen for */
  date: string;
  cabins: {
    [cabin in 'economy' | 'premiumEconomy' | 'business' | 'first']: {
      available: boolean;
      mileageCost: number | null;
      /** taxes/fees in USD — null when seats.aero quoted a non-USD currency */
      taxesUsd: number | null;
      airlines: string;
      remainingSeats: number | null;
    };
  };
  fetchedAt: string;
}

/** One upstream request: a mileage program, optionally pinned to a destination region. */
export interface BulkPull {
  source: string;
  /** seats.aero region for the DESTINATION side; omit = all regions (date-ordered slice) */
  destinationRegion?: string;
}

export interface SeatsAeroBulkAdapterOptions {
  apiKey?: string;
  baseUrl?: string;
  /** upstream requests per refresh, one call each (default: DEFAULT_BULK_PULLS) */
  pulls?: BulkPull[];
  /** seats.aero region filter for the ORIGIN side (deals the owner can actually fly) */
  originRegion?: string;
  /** search window: today+minDaysAhead .. today+maxDaysAhead */
  minDaysAhead?: number;
  maxDaysAhead?: number;
  /** page size per request (seats.aero max 1000) */
  take?: number;
}

/** Broad-coverage programs reachable from US transferable currencies. */
export const DEFAULT_BULK_SOURCES = ['aeroplan', 'american', 'alaska', 'united', 'flyingblue', 'virginatlantic'];

/**
 * Default pull plan — 8 calls per refresh, region-cycled so the deal surface is
 * genuinely WORLDWIDE (a single date-ordered page per program collapses to the
 * window's first days and near-hub domestic hops; region pins prevent that).
 * Pairings follow each program's strength (Aeroplan Europe/Asia, AA partners in
 * South America, Alaska's Asia partners, United Oceania, Flying Blue Africa,
 * Virgin Atlantic ANA/EU, AA domestic+Caribbean under North America).
 */
export const DEFAULT_BULK_PULLS: BulkPull[] = [
  { source: 'aeroplan', destinationRegion: 'Europe' },
  { source: 'aeroplan', destinationRegion: 'Asia' },
  { source: 'american', destinationRegion: 'South America' },
  { source: 'american', destinationRegion: 'North America' },
  { source: 'alaska', destinationRegion: 'Asia' },
  { source: 'united', destinationRegion: 'Oceania' },
  { source: 'flyingblue', destinationRegion: 'Africa' },
  { source: 'virginatlantic', destinationRegion: 'Europe' },
];

const CABIN_PREFIX = { economy: 'Y', premiumEconomy: 'W', business: 'J', first: 'F' } as const;

export class SeatsAeroBulkAdapter implements PointsSourceAdapter<BulkAwardRecord[]> {
  readonly id = 'seats-aero-bulk';
  readonly kind = 'json-api' as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly pulls: BulkPull[];
  private readonly originRegion: string;
  private readonly minDaysAhead: number;
  private readonly maxDaysAhead: number;
  private readonly take: number;

  constructor(opts: SeatsAeroBulkAdapterOptions = {}) {
    this.apiKey = opts.apiKey ?? '';
    this.baseUrl = opts.baseUrl ?? 'https://seats.aero/partnerapi';
    this.pulls = opts.pulls?.length ? opts.pulls : DEFAULT_BULK_PULLS;
    this.originRegion = opts.originRegion ?? 'North America';
    this.minDaysAhead = opts.minDaysAhead ?? 7;
    this.maxDaysAhead = opts.maxDaysAhead ?? 90;
    this.take = opts.take ?? 1000;
  }

  configured = (): boolean => this.apiKey.length > 0;

  async fetch(): Promise<BulkAwardRecord[]> {
    if (!this.configured()) throw new Error('SEATSAERO_API_KEY not set');
    const fetchedAt = new Date().toISOString();
    const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const startDate = day(this.minDaysAhead);
    const endDate = day(this.maxDaysAhead);

    const out: BulkAwardRecord[] = [];
    let okPulls = 0;
    for (let i = 0; i < this.pulls.length; i++) {
      const pull = this.pulls[i]!;
      const url =
        `${this.baseUrl}/availability?source=${encodeURIComponent(pull.source)}` +
        `&origin_region=${encodeURIComponent(this.originRegion)}` +
        (pull.destinationRegion ? `&destination_region=${encodeURIComponent(pull.destinationRegion)}` : '') +
        `&start_date=${startDate}&end_date=${endDate}&take=${this.take}&order_by=lowest_mileage`;
      let body: { data?: Array<Record<string, unknown>> };
      try {
        const res = await fetch(url, {
          headers: { 'Partner-Authorization': this.apiKey, accept: 'application/json' },
        });
        // NOTE: error/skip paths carry the status code ONLY — never the key.
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        body = (await res.json()) as { data?: Array<Record<string, unknown>> };
      } catch (err) {
        // One bad pull must not blank seven good ones; but if EVERY pull fails
        // we throw so the runner records a real failure (stale-serve).
        if (i === this.pulls.length - 1 && okPulls === 0) {
          throw new Error(`seats.aero bulk: all pulls failed (last: ${pull.source} -> ${String((err as Error).message)})`, { cause: err });
        }
        continue;
      }
      okPulls++;
      for (const r of body.data ?? []) {
        const rec = parseBulkRecord(r, fetchedAt);
        if (rec) out.push(rec);
      }
    }
    return out;
  }
}

/** Parse one raw seats.aero availability item; null when malformed or no verified space. */
export function parseBulkRecord(r: Record<string, unknown>, fetchedAt: string): BulkAwardRecord | null {
  const route = (r.Route ?? {}) as Record<string, unknown>;
  const origin = String(route.OriginAirport ?? '');
  const dest = String(route.DestinationAirport ?? '');
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(dest)) return null;

  const usd = String(r.TaxesCurrency ?? '') === 'USD';
  const cents = (v: unknown): number | null => (usd && v != null && Number(v) > 0 ? Math.round(Number(v)) / 100 : null);
  const num = (v: unknown): number | null => (v != null && Number(v) > 0 ? Number(v) : null);

  const cabins = {} as BulkAwardRecord['cabins'];
  let anySpace = false;
  for (const [cabin, p] of Object.entries(CABIN_PREFIX) as Array<[keyof BulkAwardRecord['cabins'], string]>) {
    const available = Boolean(r[`${p}Available`]);
    cabins[cabin] = {
      available,
      mileageCost: num(r[`${p}MileageCostRaw`] ?? r[`${p}MileageCost`]),
      taxesUsd: cents(r[`${p}TotalTaxesRaw`] ?? r[`${p}TotalTaxes`]),
      airlines: String(r[`${p}AirlinesRaw`] ?? r[`${p}Airlines`] ?? ''),
      remainingSeats: num(r[`${p}RemainingSeatsRaw`] ?? r[`${p}RemainingSeats`]),
    };
    if (available) anySpace = true;
  }
  if (!anySpace) return null; // keep payloads lean — only verified space matters downstream

  return {
    origin,
    dest,
    originRegion: String(route.OriginRegion ?? ''),
    destRegion: String(route.DestinationRegion ?? ''),
    distanceMi: Number(route.Distance ?? 0) || 0,
    source: String(r.Source ?? route.Source ?? ''),
    date: String(r.Date ?? ''),
    cabins,
    fetchedAt,
  };
}
