/**
 * Points-transfer game — shared types (HC #602).
 *
 * Three layers:
 *   1. Knowledge graph: transferable-points PROGRAMS (Chase UR, Amex MR, …) → their
 *      airline/hotel TRANSFER PARTNERS with ratios. Changes rarely → versioned static
 *      dataset in-repo (see ./data/transfer-partners.ts for the update path).
 *   2. Live-ish overlays: ACTIVE TRANSFER BONUSES (change monthly) and award
 *      availability — fetched through the points source-adapter framework
 *      (./sources/*), never hardcoded.
 *   3. User state: which cards the user HOLDS (and optional self-entered balances).
 *      NEVER card numbers, logins, or any credential. Checkbox-level data only.
 */

/** A transferable-points ecosystem (the currency the credit card earns). */
export type TransferableProgramId =
  | 'chase_ur'
  | 'amex_mr'
  | 'cap1_miles'
  | 'citi_typ'
  | 'bilt'
  | 'wf_rewards';

/**
 * Co-brand program IDs: cards that earn directly into an airline/hotel program
 * (no transfer partners — the card IS the program). These programs exist in
 * PROGRAMS for card-catalog lookups but have no transfer edges.
 */
export type CobrandProgramId =
  | 'delta_cobrand'
  | 'united_cobrand'
  | 'southwest_cobrand'
  | 'aa_cobrand'
  | 'hilton_cobrand'
  | 'marriott_cobrand'
  | 'ihg_cobrand'
  | 'hyatt_cobrand';

export type ProgramId = TransferableProgramId | CobrandProgramId;

export interface PointsProgram {
  id: ProgramId;
  name: string; // "Chase Ultimate Rewards"
  /** baseline cash-out value in cents/point (e.g. statement credit / portal floor) */
  baselineCpp: number;
}

/** An airline or hotel loyalty program you can transfer INTO. */
export interface TransferPartner {
  id: string; // "ba_avios", "flying_blue", "hyatt", …
  name: string; // "British Airways Executive Club (Avios)"
  kind: 'airline' | 'hotel';
  /** alliance / family for grouping; optional */
  family?: string;
}

/** One edge of the knowledge graph: program → partner at a ratio. */
export interface TransferEdge {
  program: ProgramId;
  partner: string; // TransferPartner.id
  /** points received per 1 program point (1.0 = 1:1, 0.8 = 1250:1000, 2.0 = 1:2) */
  ratio: number;
  /** minimum transfer increment, program points (informational) */
  minIncrement?: number;
}

/** An ACTIVE promotional transfer bonus (live-ish data, from sources). */
export interface TransferBonus {
  program: ProgramId;
  partner: string; // TransferPartner.id
  /** bonus fraction: 0.30 = "30% transfer bonus" */
  bonus: number;
  startDate?: string; // yyyy-mm-dd
  endDate?: string; // yyyy-mm-dd
  /** raw human description from the source (kept for display/audit) */
  description: string;
  source: string; // adapter id that produced it
  fetchedAt: string; // ISO
}

/** A credit card the user can tick off. Identity only — never numbers/credentials. */
export interface CardDefinition {
  id: string; // "chase_sapphire_preferred"
  name: string; // "Chase Sapphire Preferred"
  issuer: string; // "Chase"
  program: ProgramId;
  /**
   * true when holding this card unlocks transfers to partners
   * (e.g. CSP yes; Freedom Flex earns UR but cannot transfer alone).
   */
  transferEnabled: boolean;
}

/** User's held-card state (the ONLY user data we store). */
export interface HeldCard {
  cardId: string;
  held: boolean;
  /** optional self-entered points balance (program points) */
  balance?: number | null;
}

// ---------------------------------------------------------------------------
// Valuation
// ---------------------------------------------------------------------------

/** One candidate way to pay a trip with points. */
export interface PointsPath {
  program: ProgramId;
  programName: string;
  partner: string;
  partnerName: string;
  /** transfer ratio actually applied (base ratio) */
  ratio: number;
  /** active bonus fraction applied (0 when none) */
  bonus: number;
  /** estimated partner miles needed, round-trip economy */
  partnerMilesNeeded: number;
  /** program points to transfer after ratio+bonus */
  programPointsNeeded: number;
  /** estimated award taxes/fees USD (heuristic, documented) */
  feesEstUsd: number;
  /** cents-per-point achieved vs the cash fare */
  cpp: number;
  /** program baseline cpp for comparison */
  baselineCpp: number;
  /** human verdict line, e.g. "transfer 24k UR→Avios (30% bonus) …" */
  verdict: string;
  /** estimate quality: 'chart' = published distance chart; 'heuristic' = modeled */
  estimateQuality: 'chart' | 'heuristic';
}

/** Valuation result attached to a deal. */
export interface PointsValuation {
  flyTo: string;
  cashPrice: number;
  distanceMiles: number;
  best: PointsPath | null;
  /** all evaluated paths, best-first (capped) */
  paths: PointsPath[];
  /** true when an active transfer bonus improved the best path */
  bonusApplied: boolean;
  /** honest caveat: availability is NOT verified unless an award-search source is live */
  availabilityVerified: boolean;
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Source-adapter framework (generalizes the AggregateProvider pattern)
// ---------------------------------------------------------------------------

export type SourceKind = 'json-api' | 'rss' | 'html' | 'static';

export type SourceStatus =
  | 'ok' // fresh data
  | 'stale' // serving cached data past TTL (source unreachable but we have history)
  | 'unavailable' // no data at all (source down and no cache)
  | 'unconfigured'; // needs a key/flag that isn't set (e.g. seats.aero pro)

export interface SourceHealth {
  id: string;
  kind: SourceKind;
  status: SourceStatus;
  /** ISO of last successful fetch (null = never) */
  lastSuccessAt: string | null;
  /** age of the data being served, ms (null = no data) */
  dataAgeMs: number | null;
  lastError: string | null;
  /** consecutive failures since last success */
  failureCount: number;
}

/**
 * A points data source. Implementations fetch + normalize ONE payload type.
 * The SourceRunner wraps it with TTL cache, retry/backoff, freshness stamps,
 * health status and stale-grace degradation — adapters stay dumb fetchers.
 */
export interface PointsSourceAdapter<T> {
  id: string;
  kind: SourceKind;
  /** throw on failure; return normalized payload on success */
  fetch(): Promise<T>;
  /** when false the runner reports 'unconfigured' and never fetches (e.g. missing key) */
  configured?: () => boolean;
}

export interface SourceRunnerOptions<T = unknown> {
  /** data considered fresh for this long, ms */
  ttlMs: number;
  /** keep serving cached data (status 'stale') for this long past TTL, ms */
  staleGraceMs?: number;
  /** retry attempts per refresh (default 2) */
  retries?: number;
  /** base backoff, ms (default 1500; doubles per attempt) */
  backoffMs?: number;
  /** per-attempt timeout, ms (default 20s) */
  timeoutMs?: number;
  /**
   * Optional disk persistence (HC #604): `load` is called lazily ONCE (first
   * get()/health()) to pre-seed the cache so data survives process restarts;
   * `save` is called after every successful refresh. Both are best-effort —
   * persistence failures NEVER break fetching or serving.
   */
  persist?: SourcePersistence<T>;
}

/** Persistence hooks for SourceRunner — typically backed by SQLite/disk in the API. */
export interface SourcePersistence<T> {
  load(): { data: T; fetchedAt: string } | null;
  save(data: T, fetchedAtIso: string): void;
}

/** What a runner hands back: data (possibly stale) + honest provenance. */
export interface SourceResult<T> {
  data: T | null;
  health: SourceHealth;
  fetchedAt: string | null;
}
