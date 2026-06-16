/**
 * HC #606 — layover / day-trip feasibility classifier.
 *
 * DATA HONESTY: our bulk fare sources (Travelpayouts v2/v3, Kiwi one-per-city)
 * report at most TOTAL travel minutes + number of transfers. They do NOT give
 * us segment times, layover airports, or local clock times. So everything here
 * is an interval ESTIMATE: we model plausible air time from great-circle
 * distance and attribute the remaining "ground slack" to layovers. Every
 * consumer must label the output as approximate — we classify a deal as a
 * day-trip candidate ONLY when the entire estimated interval supports it, and
 * we hide a deal for exceeding a layover cap ONLY when even the lower bound
 * violates it. Unknowns are never punished.
 */

/** One direction (or a round trip, see travelMinutesAreRoundTrip) of a priced itinerary. */
export interface LayoverInput {
  /** Reported total travel minutes (gate to gate, incl. layovers). null/undefined = unknown. */
  travelMinutes?: number | null;
  /** One-way great-circle distance in MILES (FareQuote.distance). */
  distanceMiles?: number | null;
  /** Number of stops on the leg (0 = nonstop). null/undefined = unknown. */
  transfers?: number | null;
  /**
   * TP v2 `duration` (wall durationMin) is the ROUND-TRIP total. When true we
   * split it into a one-way estimate with an asymmetry margin (45%..55%).
   */
  travelMinutesAreRoundTrip?: boolean;
}

export interface AirTimeBounds {
  /** Optimistic air minutes: fast cruise, direct routing, quick turns. */
  lo: number;
  /** Pessimistic air minutes: slow cruise, 25% routing detour, long taxi. */
  hi: number;
}

export interface LayoverBounds {
  /** Plausible total ground-slack minutes on the leg [lo, hi]. */
  slackLo: number;
  slackHi: number;
  /** Lower bound on the LONGEST single layover (slackLo / stops). */
  longestLayoverLo: number;
  /** Upper bound on the longest single layover (all slack at one stop). */
  longestLayoverHi: number;
  stops: number;
}

export type DayTripKind =
  | 'unknown' // missing data — can't say anything
  | 'nonstop' // no layover at all
  | 'short-connection' // slack can't reach a usable stopover even optimistically
  | 'too-long' // even the optimistic estimate is an overnight-plus sit
  | 'ambiguous' // interval straddles the usable window — NOT advertised
  | 'day-trip'; // whole interval fits the usable 6h–24h window

export interface DayTripAssessment {
  kind: DayTripKind;
  /** Midpoint estimate of the longest layover, minutes (when computable). */
  approxLayoverMin: number | null;
  /** Always true — there is no exact layover data in our sources. */
  approximate: true;
}

/** A layover must be at least this long to be sold as a mini day trip (6h landside). */
export const DAY_TRIP_MIN_LAYOVER_MIN = 360;
/** ...and at most this long — beyond 24h it's a multi-day sit, not a stopover. */
export const DAY_TRIP_MAX_LAYOVER_MIN = 1440;

/** Modeled air time interval for a one-way leg from distance + stop count. */
export function estimateAirMinutes(distanceMiles: number, stops: number): AirTimeBounds {
  const segs = Math.max(1, stops + 1);
  // lo: 560mph straight-line + 25 min/segment overhead (taxi, climb, approach)
  const lo = (distanceMiles / 560) * 60 + segs * 25;
  // hi: 470mph with a 25% routing detour + 50 min/segment overhead
  const hi = ((distanceMiles * 1.25) / 470) * 60 + segs * 50;
  return { lo, hi };
}

/**
 * Estimate ground-slack (layover) bounds for a leg. Returns null when any
 * required input is missing or nonsensical — callers must treat null as
 * "unknown", never as "fine" or "bad".
 */
export function estimateLayoverBounds(input: LayoverInput): LayoverBounds | null {
  const { travelMinutes, distanceMiles, transfers, travelMinutesAreRoundTrip } = input;
  if (
    travelMinutes == null || !Number.isFinite(travelMinutes) || travelMinutes <= 0 ||
    distanceMiles == null || !Number.isFinite(distanceMiles) || distanceMiles <= 0 ||
    transfers == null || !Number.isFinite(transfers) || transfers < 0
  ) {
    return null;
  }
  const stops = Math.floor(transfers);
  if (stops === 0) {
    return { slackLo: 0, slackHi: 0, longestLayoverLo: 0, longestLayoverHi: 0, stops: 0 };
  }
  // One-way travel-time interval. RT totals are split with a 45/55 asymmetry margin.
  const travelLo = travelMinutesAreRoundTrip ? travelMinutes * 0.45 : travelMinutes;
  const travelHi = travelMinutesAreRoundTrip ? travelMinutes * 0.55 : travelMinutes;
  const air = estimateAirMinutes(distanceMiles, stops);
  const slackLo = Math.max(0, travelLo - air.hi);
  const slackHi = Math.max(0, travelHi - air.lo);
  return {
    slackLo,
    slackHi,
    longestLayoverLo: slackLo / stops, // average lower-bounds the max
    longestLayoverHi: slackHi, // all slack could sit at one stop
    stops,
  };
}

/**
 * Conservative day-trip classification. Advertises 'day-trip' ONLY when:
 *  - exactly 1 stop (multi-stop slack attribution is too uncertain to sell), and
 *  - the ENTIRE estimated layover interval fits [6h, 24h].
 * Anything straddling the window is 'ambiguous' and must NOT be badged.
 */
export function classifyDayTrip(input: LayoverInput): DayTripAssessment {
  const bounds = estimateLayoverBounds(input);
  if (bounds === null) return { kind: 'unknown', approxLayoverMin: null, approximate: true };
  if (bounds.stops === 0) return { kind: 'nonstop', approxLayoverMin: 0, approximate: true };

  const approx = Math.round((bounds.longestLayoverLo + bounds.longestLayoverHi) / 2);
  if (bounds.longestLayoverHi < DAY_TRIP_MIN_LAYOVER_MIN) {
    return { kind: 'short-connection', approxLayoverMin: approx, approximate: true };
  }
  if (bounds.longestLayoverLo > DAY_TRIP_MAX_LAYOVER_MIN) {
    return { kind: 'too-long', approxLayoverMin: approx, approximate: true };
  }
  if (
    bounds.stops === 1 &&
    bounds.longestLayoverLo >= DAY_TRIP_MIN_LAYOVER_MIN &&
    bounds.longestLayoverHi <= DAY_TRIP_MAX_LAYOVER_MIN
  ) {
    return { kind: 'day-trip', approxLayoverMin: approx, approximate: true };
  }
  return { kind: 'ambiguous', approxLayoverMin: approx, approximate: true };
}

/**
 * Should this deal be HIDDEN by a max-layover preference? Only when we are
 * CONFIDENT it violates the cap: even the per-stop lower bound exceeds it.
 * Unknown-duration deals are always kept (return false).
 */
export function exceedsMaxLayover(input: LayoverInput, maxLayoverHours: number): boolean {
  if (!Number.isFinite(maxLayoverHours) || maxLayoverHours <= 0) return false;
  const bounds = estimateLayoverBounds(input);
  if (bounds === null || bounds.stops === 0) return false;
  return bounds.longestLayoverLo > maxLayoverHours * 60;
}

/**
 * Should this deal be HIDDEN by a max-travel-time preference (ONE-WAY hours)?
 * Wall durations are round-trip, so we compare against 2× the cap. Unknown
 * durations are always kept.
 */
export function exceedsMaxTravelTime(
  travelMinutes: number | null | undefined,
  maxTravelHoursOneWay: number,
  travelMinutesAreRoundTrip = true,
): boolean {
  if (!Number.isFinite(maxTravelHoursOneWay) || maxTravelHoursOneWay <= 0) return false;
  if (travelMinutes == null || !Number.isFinite(travelMinutes) || travelMinutes <= 0) return false;
  const capMin = maxTravelHoursOneWay * 60 * (travelMinutesAreRoundTrip ? 2 : 1);
  return travelMinutes > capMin;
}
