/**
 * seats.aero Partner API adapter — VERIFIED award availability (the gold standard).
 *
 * HC #607 (2026-06-11): the owner PAID for the Partner API Pro subscription, so
 * this source is now LIVE. Auth: header `Partner-Authorization: <key>` against
 * https://seats.aero/partnerapi/* — we use the cached-search endpoint
 * GET /partnerapi/search?origin_airport=X&destination_airport=Y&take=N
 * (response shape verified live 2026-06-11, all four cabins: data[].Source =
 * mileage program, Date, {Y,W,J,F}Available, {Y,W,J,F}MileageCostRaw,
 * {Y,W,J,F}TotalTaxesRaw in cents, {Y,W,J,F}AirlinesRaw,
 * {Y,W,J,F}RemainingSeatsRaw, TaxesCurrency. Y=economy, W=premium economy,
 * J=business, F=first. The un-suffixed `XAvailable` flags are seats.aero's
 * sanity-FILTERED availability (absurd dynamic-priced awards excluded, e.g. a
 * 485k-mile J seat shows XAvailableRaw=true but XAvailable=false) — we
 * deliberately trust the FILTERED flags so junk awards never become "verified").
 *
 * SECURITY: the key lives in the backend's env ONLY. It is injected here by the
 * API process, sent only to seats.aero, and never appears in any payload this
 * adapter returns (so it can never leak through /points/* responses or the
 * persisted source_cache rows).
 *
 * HONESTY: this source verifies AWARD space (points side) only — it is NOT a
 * cash-fare source and must never be presented as one. Records carry
 * provenance and the summary is labeled "verified award space".
 *
 * RATE LIMITS: Pro tier is quota'd. The SourceRunner caches for 6h (seats.aero's
 * own availability cache refreshes roughly daily) and this adapter probes at
 * most 10 destinations per refresh (sequential, one page each) — worst case
 * ~40 requests/day, far under quota. UI traffic can never trigger live calls
 * beyond that: everything is served from the runner cache.
 *
 * PREMIUM CABINS (HC #608 — un-deferred now that the Pro key is live): W/J/F
 * award space is captured per cabin and valuated in valuation.ts
 * (`valuateVerifiedCabin`). Economy cpp uses the REAL cash quote; premium cpp
 * uses a documented modeled cabin-fare benchmark and is honestly labeled
 * `fareBasis: 'modeled'` end-to-end (owner instruction 2026-06-11 supersedes
 * the earlier defer-until-premium-cash-source note).
 */

import type { PointsSourceAdapter } from '../types.js';

/** Cabin keys, in display order. seats.aero letter codes: Y/W/J/F. */
export const CABINS = ['economy', 'premiumEconomy', 'business', 'first'] as const;
export type Cabin = (typeof CABINS)[number];
export const CABIN_LABELS: Record<Cabin, string> = {
  economy: 'economy',
  premiumEconomy: 'premium economy',
  business: 'business',
  first: 'first',
};

/** Per-cabin availability captured from one seats.aero record. */
export interface CabinAvailability {
  available: boolean;
  mileageCost: number | null;
  taxesUsd: number | null;
  airlines: string;
  remainingSeats: number | null;
}

export interface AwardAvailability {
  route: string; // "MCO-LHR"
  source: string; // mileage program key per seats.aero (e.g. "american", "qantas")
  date: string; // yyyy-mm-dd
  economyAvailable: boolean;
  economyMileageCost: number | null;
  economyTaxesUsd: number | null;
  economyAirlines: string;
  economyRemainingSeats: number | null;
  /** W cabin (premium economy) — optional so pre-HC#608 cached payloads stay readable */
  premiumEconomyAvailable?: boolean;
  premiumEconomyMileageCost?: number | null;
  premiumEconomyTaxesUsd?: number | null;
  premiumEconomyAirlines?: string;
  premiumEconomyRemainingSeats?: number | null;
  businessAvailable: boolean;
  businessMileageCost: number | null;
  businessTaxesUsd: number | null;
  businessAirlines: string;
  businessRemainingSeats: number | null;
  /** F cabin (first) — optional so pre-HC#608 cached payloads stay readable */
  firstAvailable?: boolean;
  firstMileageCost?: number | null;
  firstTaxesUsd?: number | null;
  firstAirlines?: string;
  firstRemainingSeats?: number | null;
  fetchedAt: string;
}

/** Normalized per-cabin view over the (historically flat) AwardAvailability record. */
export function cabinOf(r: AwardAvailability, cabin: Cabin): CabinAvailability {
  switch (cabin) {
    case 'economy':
      return { available: r.economyAvailable, mileageCost: r.economyMileageCost, taxesUsd: r.economyTaxesUsd, airlines: r.economyAirlines, remainingSeats: r.economyRemainingSeats };
    case 'premiumEconomy':
      return { available: r.premiumEconomyAvailable ?? false, mileageCost: r.premiumEconomyMileageCost ?? null, taxesUsd: r.premiumEconomyTaxesUsd ?? null, airlines: r.premiumEconomyAirlines ?? '', remainingSeats: r.premiumEconomyRemainingSeats ?? null };
    case 'business':
      return { available: r.businessAvailable, mileageCost: r.businessMileageCost, taxesUsd: r.businessTaxesUsd, airlines: r.businessAirlines, remainingSeats: r.businessRemainingSeats };
    case 'first':
      return { available: r.firstAvailable ?? false, mileageCost: r.firstMileageCost ?? null, taxesUsd: r.firstTaxesUsd ?? null, airlines: r.firstAirlines ?? '', remainingSeats: r.firstRemainingSeats ?? null };
  }
}

/** seats.aero `Source` keys → human program names (for UI labels server-side). */
export const SEATS_PROGRAM_NAMES: Record<string, string> = {
  aeroplan: 'Air Canada Aeroplan',
  american: 'American AAdvantage',
  alaska: 'Alaska Mileage Plan',
  delta: 'Delta SkyMiles',
  emirates: 'Emirates Skywards',
  etihad: 'Etihad Guest',
  flyingblue: 'Air France/KLM Flying Blue',
  jetblue: 'JetBlue TrueBlue',
  qantas: 'Qantas Frequent Flyer',
  qatar: 'Qatar Avios',
  singapore: 'Singapore KrisFlyer',
  smiles: 'GOL Smiles',
  turkish: 'Turkish Miles&Smiles',
  united: 'United MileagePlus',
  velocity: 'Virgin Australia Velocity',
  virginatlantic: 'Virgin Atlantic Flying Club',
  azul: 'Azul TudoAzul',
  aeromexico: 'Aeromexico Rewards',
  saudia: 'Saudia Alfursan',
  spirit: 'Spirit Free Spirit',
  frontier: 'Frontier Miles',
  southwest: 'Southwest Rapid Rewards',
  copa: 'Copa ConnectMiles',
  lifemiles: 'Avianca LifeMiles',
  eurobonus: 'SAS EuroBonus',
  connectmiles: 'Copa ConnectMiles',
};

export interface VerifiedCabinAward {
  cabin: Cabin;
  /** cheapest VERIFIED-available award seen for the cabin (ONE-WAY partner miles) */
  miles: number;
  taxesUsd: number | null;
  /** seats.aero program key + pretty name */
  program: string;
  programName: string;
  airlines: string;
  date: string;
  remainingSeats: number | null;
  /**
   * HC #608 — cpp valuation for the user's HELD cards (attached server-side by
   * the points service via valuation.ts, null when no transfer path exists).
   * Economy: real cash quote (`fareBasis: 'cash'`); W/J/F: modeled cabin-fare
   * benchmark, honestly labeled (`fareBasis: 'modeled'`).
   */
  valuation?: VerifiedCabinValuation | null;
}

/** HC #608 — best held-card transfer valuation for one verified cabin award. */
export interface VerifiedCabinValuation {
  cabin: Cabin;
  /** our ProgramId (e.g. 'chase_ur') + display name */
  program: string;
  programName: string;
  partner: string;
  partnerName: string;
  /** active transfer bonus fraction applied (0 = none) */
  bonus: number;
  /** program points to transfer, ROUND-TRIP (2× verified one-way miles), 1k blocks */
  programPointsNeeded: number;
  /** cents-per-point vs the reference fare */
  cpp: number;
  /** reference round-trip cash fare used for the cpp numerator */
  refFareUsd: number;
  /** 'cash' = real economy quote; 'modeled' = documented cabin multiplier (honesty label) */
  fareBasis: 'cash' | 'modeled';
  verdict: string;
}

/**
 * Per-destination rollup of verified award space — what the deals wall renders.
 * `provenance` is the binding honesty label: seats.aero verifies AWARD space,
 * never cash fares.
 */
export interface VerifiedAwardSummary {
  route: string;
  flyTo: string;
  provider: 'seats.aero';
  provenance: 'verified award space';
  fetchedAt: string;
  /** distinct dates with any verified space (a depth signal, not a guarantee) */
  daysWithSpace: number;
  /** distinct mileage programs showing space */
  programs: string[];
  economy: VerifiedCabinAward | null;
  premiumEconomy: VerifiedCabinAward | null;
  business: VerifiedCabinAward | null;
  first: VerifiedCabinAward | null;
}

/** Roll raw availability records up to one verified summary per destination. */
export function summarizeVerifiedAwards(records: AwardAvailability[]): Record<string, VerifiedAwardSummary> {
  const byDest = new Map<string, AwardAvailability[]>();
  for (const r of records) {
    const dest = r.route.split('-')[1] ?? '';
    if (!dest) continue;
    if (!byDest.has(dest)) byDest.set(dest, []);
    byDest.get(dest)!.push(r);
  }
  const out: Record<string, VerifiedAwardSummary> = {};
  for (const [dest, recs] of byDest) {
    const bestCabin = (cabin: Cabin): VerifiedCabinAward | null => {
      let best: { rec: AwardAvailability; c: CabinAvailability } | null = null;
      for (const r of recs) {
        const c = cabinOf(r, cabin);
        if (!c.available || c.mileageCost == null || c.mileageCost <= 0) continue;
        if (best == null || c.mileageCost < (best.c.mileageCost as number)) best = { rec: r, c };
      }
      if (!best) return null;
      return {
        cabin,
        miles: best.c.mileageCost as number,
        taxesUsd: best.c.taxesUsd,
        program: best.rec.source,
        programName: SEATS_PROGRAM_NAMES[best.rec.source] ?? best.rec.source,
        airlines: best.c.airlines,
        date: best.rec.date,
        remainingSeats: best.c.remainingSeats,
      };
    };
    const [economy, premiumEconomy, business, first] = CABINS.map(bestCabin);
    if (!economy && !premiumEconomy && !business && !first) continue; // no verified space → honest absence, no entry
    const anySpace = (r: AwardAvailability) => CABINS.some((cab) => cabinOf(r, cab).available);
    const withSpace = recs.filter(anySpace);
    out[dest] = {
      route: recs[0]!.route,
      flyTo: dest,
      provider: 'seats.aero',
      provenance: 'verified award space',
      fetchedAt: recs[0]!.fetchedAt,
      daysWithSpace: new Set(withSpace.map((r) => r.date)).size,
      programs: [...new Set(withSpace.map((r) => r.source))],
      economy: economy ?? null,
      premiumEconomy: premiumEconomy ?? null,
      business: business ?? null,
      first: first ?? null,
    };
  }
  return out;
}

export interface SeatsAeroAdapterOptions {
  apiKey?: string;
  baseUrl?: string;
  origin?: string;
  /**
   * Destinations to probe. A static list OR a function resolved at fetch time
   * (HC #604: the API passes a live "current top deals" getter so the adapter
   * probes routes that actually matter the moment a key is pasted in —
   * activation stays zero-code).
   */
  destinations?: string[] | (() => string[]);
}

export class SeatsAeroAdapter implements PointsSourceAdapter<AwardAvailability[]> {
  readonly id = 'seats-aero';
  readonly kind = 'json-api' as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly origin: string;
  private readonly destinations: string[] | (() => string[]);

  constructor(opts: SeatsAeroAdapterOptions = {}) {
    this.apiKey = opts.apiKey ?? '';
    this.baseUrl = opts.baseUrl ?? 'https://seats.aero/partnerapi';
    this.origin = opts.origin ?? 'MCO';
    this.destinations = opts.destinations ?? [];
  }

  configured = (): boolean => this.apiKey.length > 0;

  async fetch(): Promise<AwardAvailability[]> {
    if (!this.configured()) throw new Error('SEATSAERO_API_KEY not set');
    const fetchedAt = new Date().toISOString();
    const list = typeof this.destinations === 'function' ? this.destinations() : this.destinations;
    const dests = list.slice(0, 10); // be polite to the API (Pro quota)
    if (dests.length === 0) {
      throw new Error('no destinations to probe yet (fare cache cold) — retry next cycle');
    }
    const out: AwardAvailability[] = [];
    for (const dest of dests) {
      const url = `${this.baseUrl}/search?origin_airport=${this.origin}&destination_airport=${dest}&take=100`;
      const res = await fetch(url, {
        headers: { 'Partner-Authorization': this.apiKey, accept: 'application/json' },
      });
      // NOTE: error messages carry the status code ONLY — never the key.
      if (!res.ok) throw new Error(`seats.aero ${dest} -> HTTP ${res.status}`);
      const body = (await res.json()) as { data?: Array<Record<string, unknown>> };
      for (const r of body.data ?? []) {
        const usd = String(r.TaxesCurrency ?? '') === 'USD';
        const cents = (v: unknown): number | null => (usd && v != null && Number(v) > 0 ? Math.round(Number(v)) / 100 : null);
        const num = (v: unknown): number | null => (v != null && Number(v) > 0 ? Number(v) : null);
        const rec: AwardAvailability = {
          route: `${this.origin}-${dest}`,
          source: String(r.Source ?? ''),
          date: String(r.Date ?? ''),
          economyAvailable: Boolean(r.YAvailable),
          economyMileageCost: num(r.YMileageCostRaw ?? r.YMileageCost),
          economyTaxesUsd: cents(r.YTotalTaxesRaw ?? r.YTotalTaxes),
          economyAirlines: String(r.YAirlinesRaw ?? r.YAirlines ?? ''),
          economyRemainingSeats: num(r.YRemainingSeatsRaw ?? r.YRemainingSeats),
          premiumEconomyAvailable: Boolean(r.WAvailable),
          premiumEconomyMileageCost: num(r.WMileageCostRaw ?? r.WMileageCost),
          premiumEconomyTaxesUsd: cents(r.WTotalTaxesRaw ?? r.WTotalTaxes),
          premiumEconomyAirlines: String(r.WAirlinesRaw ?? r.WAirlines ?? ''),
          premiumEconomyRemainingSeats: num(r.WRemainingSeatsRaw ?? r.WRemainingSeats),
          businessAvailable: Boolean(r.JAvailable),
          businessMileageCost: num(r.JMileageCostRaw ?? r.JMileageCost),
          businessTaxesUsd: cents(r.JTotalTaxesRaw ?? r.JTotalTaxes),
          businessAirlines: String(r.JAirlinesRaw ?? r.JAirlines ?? ''),
          businessRemainingSeats: num(r.JRemainingSeatsRaw ?? r.JRemainingSeats),
          firstAvailable: Boolean(r.FAvailable),
          firstMileageCost: num(r.FMileageCostRaw ?? r.FMileageCost),
          firstTaxesUsd: cents(r.FTotalTaxesRaw ?? r.FTotalTaxes),
          firstAirlines: String(r.FAirlinesRaw ?? r.FAirlines ?? ''),
          firstRemainingSeats: num(r.FRemainingSeatsRaw ?? r.FRemainingSeats),
          fetchedAt,
        };
        // keep the payload lean: only rows with some verified space matter downstream
        if (rec.economyAvailable || rec.premiumEconomyAvailable || rec.businessAvailable || rec.firstAvailable) out.push(rec);
      }
    }
    return out;
  }
}
