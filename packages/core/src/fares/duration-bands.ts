/**
 * HC #619 — distance-banded trip-duration realism (SINGLE SOURCE OF TRUTH).
 *
 * Owner verbatim 2026-06-13: *"trips over a month long are probably a no go for
 * MOST consumers when considering deals.... be realistic based on distance.
 * closer destinations might warrant shorter trips farther destinations probably
 * longer? in a general assumption"*
 *
 * Bands (great-circle miles → reasonable trip-length window in nights):
 *   short-haul     <1500 mi  → 3–7 nights
 *   medium-haul    1500–4000 → 5–10 nights
 *   long-haul      4000–7000 → 7–14 nights
 *   ultra-long-haul >7000    → 10–21 nights
 *
 * HARD CAP: default consumer-facing feeds never default-search beyond ~30
 * nights. Trips >30n are opt-in only and ALWAYS get a "long stay" badge.
 *
 * Every provider that bounds trip length (Kiwi nightsCount, Tequila nights_in_dst,
 * future seats.aero pairing) imports from here so the realism rule is enforced
 * in ONE place, not duplicated.
 */

export interface DurationBand {
  /** human-readable band id (used for telemetry / debugging) */
  id: 'short' | 'medium' | 'long' | 'ultra';
  /** min realistic trip length in nights for this distance band */
  minNights: number;
  /** max realistic trip length in nights for this distance band */
  maxNights: number;
}

/** Hard cap on default-feed trip length (nights). HC #619 R1. */
export const DEFAULT_MAX_NIGHTS = 30;

/** Anything strictly greater than this is "long stay" — opt-in only. */
export const LONG_STAY_THRESHOLD_NIGHTS = DEFAULT_MAX_NIGHTS;

/** Resolve the realistic trip-length window for a given great-circle distance. */
export function durationBandForDistance(distanceMi: number): DurationBand {
  const d = Math.max(0, distanceMi || 0);
  if (d < 1500) return { id: 'short', minNights: 3, maxNights: 7 };
  if (d < 4000) return { id: 'medium', minNights: 5, maxNights: 10 };
  if (d < 7000) return { id: 'long', minNights: 7, maxNights: 14 };
  return { id: 'ultra', minNights: 10, maxNights: 21 };
}

/**
 * The provider-facing default window when an ORIGIN doesn't yet know which
 * destinations the query will hit (the "anywhere" fan-out case): widen enough
 * to cover the realistic range from short-haul shortest (3) to long-haul
 * typical (14) — capped at DEFAULT_MAX_NIGHTS so >30-night noise is excluded
 * from defaults.
 *
 * Providers that DO know the destination distance should call
 * durationBandForDistance() and pass that band's bounds instead.
 */
export function defaultProviderNightsWindow(): { min: number; max: number } {
  return { min: 3, max: 14 };
}

/**
 * Clamp any provider window to the HARD ~30-night cap. Pass through anything
 * narrower; never let a window exceed it for the default feed.
 */
export function clampToConsumerCap(min: number, max: number): { min: number; max: number } {
  return {
    min: Math.max(1, Math.min(min, DEFAULT_MAX_NIGHTS)),
    max: Math.max(1, Math.min(max, DEFAULT_MAX_NIGHTS)),
  };
}

/**
 * True when a trip length exceeds the consumer-facing default cap (i.e. needs
 * the "long stay" badge and the opt-in feed).
 */
export function isLongStay(nights: number | null | undefined): boolean {
  return nights != null && Number.isFinite(nights) && nights > LONG_STAY_THRESHOLD_NIGHTS;
}

/**
 * Compute nights between an outbound and inbound yyyy-mm-dd. Returns null when
 * either side is missing/invalid OR the result is negative (bad data).
 */
export function nightsBetween(departIso: string | null | undefined, returnIso: string | null | undefined): number | null {
  if (!departIso || !returnIso) return null;
  const a = Date.parse(`${departIso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${returnIso.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const n = Math.round((b - a) / 86_400_000);
  return n >= 0 ? n : null;
}
