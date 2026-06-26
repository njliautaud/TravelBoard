/**
 * HC #606 — feasibility classifier tests. The user's edge cases, hard:
 * overnight sits, 2h connections, 30h monsters, unknowns, multi-stop
 * attribution, round-trip splitting, and the conservative-hiding contract.
 */

import { describe, expect, it } from 'vitest';
import {
  DAY_TRIP_MAX_LAYOVER_MIN,
  DAY_TRIP_MIN_LAYOVER_MIN,
  classifyDayTrip,
  estimateAirMinutes,
  estimateLayoverBounds,
  exceedsMaxLayover,
  exceedsMaxTravelTime,
} from './feasibility';

describe('estimateAirMinutes', () => {
  it('lo is strictly below hi for any sane distance', () => {
    for (const d of [200, 1000, 4000, 9000]) {
      const b = estimateAirMinutes(d, 1);
      expect(b.lo).toBeLessThan(b.hi);
      expect(b.lo).toBeGreaterThan(0);
    }
  });

  it('more stops add overhead to both bounds', () => {
    const one = estimateAirMinutes(4000, 1);
    const two = estimateAirMinutes(4000, 2);
    expect(two.lo).toBeGreaterThan(one.lo);
    expect(two.hi).toBeGreaterThan(one.hi);
  });

  it('roughly brackets a real flight (transatlantic ~4000mi nonstop ≈ 8-9h air)', () => {
    const b = estimateAirMinutes(4000, 0);
    expect(b.lo).toBeLessThan(8.5 * 60);
    expect(b.hi).toBeGreaterThan(8.5 * 60);
  });
});

describe('estimateLayoverBounds — unknowns and degenerates', () => {
  it('returns null when any input is missing', () => {
    expect(estimateLayoverBounds({ travelMinutes: null, distanceMiles: 4000, transfers: 1 })).toBeNull();
    expect(estimateLayoverBounds({ travelMinutes: 1200, distanceMiles: null, transfers: 1 })).toBeNull();
    expect(estimateLayoverBounds({ travelMinutes: 1200, distanceMiles: 4000, transfers: null })).toBeNull();
    expect(estimateLayoverBounds({})).toBeNull();
  });

  it('returns null on nonsense (zero/negative/NaN)', () => {
    expect(estimateLayoverBounds({ travelMinutes: 0, distanceMiles: 4000, transfers: 1 })).toBeNull();
    expect(estimateLayoverBounds({ travelMinutes: -5, distanceMiles: 4000, transfers: 1 })).toBeNull();
    expect(estimateLayoverBounds({ travelMinutes: 1200, distanceMiles: 4000, transfers: -1 })).toBeNull();
    expect(estimateLayoverBounds({ travelMinutes: NaN, distanceMiles: 4000, transfers: 1 })).toBeNull();
  });

  it('nonstop has exactly zero slack', () => {
    const b = estimateLayoverBounds({ travelMinutes: 500, distanceMiles: 4000, transfers: 0 });
    expect(b).toEqual({ slackLo: 0, slackHi: 0, longestLayoverLo: 0, longestLayoverHi: 0, stops: 0 });
  });

  it('slack is clamped at zero when reported travel beats the optimistic model', () => {
    // 4000mi 1-stop in 7h reported — faster than physically modeled; never negative slack.
    const b = estimateLayoverBounds({ travelMinutes: 420, distanceMiles: 4000, transfers: 1 });
    expect(b).not.toBeNull();
    expect(b!.slackLo).toBe(0);
    expect(b!.slackHi).toBe(0);
  });

  it('bounds are ordered: slackLo ≤ slackHi, longestLo ≤ longestHi', () => {
    const b = estimateLayoverBounds({ travelMinutes: 1500, distanceMiles: 4000, transfers: 2 })!;
    expect(b.slackLo).toBeLessThanOrEqual(b.slackHi);
    expect(b.longestLayoverLo).toBeLessThanOrEqual(b.longestLayoverHi);
  });

  it('2-stop attribution: longest-layover lower bound is slack/2, upper bound is all of it', () => {
    const b = estimateLayoverBounds({ travelMinutes: 1500, distanceMiles: 4000, transfers: 2 })!;
    expect(b.stops).toBe(2);
    expect(b.longestLayoverLo).toBeCloseTo(b.slackLo / 2, 6);
    expect(b.longestLayoverHi).toBeCloseTo(b.slackHi, 6);
  });

  it('round-trip totals are split with a 45/55 asymmetry margin', () => {
    const rt = estimateLayoverBounds({
      travelMinutes: 2400,
      distanceMiles: 4000,
      transfers: 1,
      travelMinutesAreRoundTrip: true,
    })!;
    const lo = estimateLayoverBounds({ travelMinutes: 1080, distanceMiles: 4000, transfers: 1 })!; // 45%
    const hi = estimateLayoverBounds({ travelMinutes: 1320, distanceMiles: 4000, transfers: 1 })!; // 55%
    expect(rt.slackLo).toBeCloseTo(lo.slackLo, 6);
    expect(rt.slackHi).toBeCloseTo(hi.slackHi, 6);
  });
});

describe('classifyDayTrip', () => {
  it('unknown when data is missing — never guesses', () => {
    const a = classifyDayTrip({ travelMinutes: null, distanceMiles: 4000, transfers: 1 });
    expect(a.kind).toBe('unknown');
    expect(a.approxLayoverMin).toBeNull();
    expect(a.approximate).toBe(true);
  });

  it('nonstop is nonstop', () => {
    expect(classifyDayTrip({ travelMinutes: 540, distanceMiles: 4000, transfers: 0 }).kind).toBe('nonstop');
  });

  it('a ~2h connection is short-connection, never a day trip', () => {
    // 4000mi 1-stop, 12h total one-way: slack interval tops out ~4h < 6h floor.
    const a = classifyDayTrip({ travelMinutes: 720, distanceMiles: 4000, transfers: 1 });
    expect(a.kind).toBe('short-connection');
  });

  it('a genuinely long usable stopover (1 stop, whole interval in 6-24h) is a day-trip candidate', () => {
    // 4000mi 1-stop, 20h one-way: slack ≈ 7.7h-12h → entirely inside the window.
    const a = classifyDayTrip({ travelMinutes: 1200, distanceMiles: 4000, transfers: 1 });
    expect(a.kind).toBe('day-trip');
    expect(a.approxLayoverMin).toBeGreaterThanOrEqual(DAY_TRIP_MIN_LAYOVER_MIN);
    expect(a.approxLayoverMin).toBeLessThanOrEqual(DAY_TRIP_MAX_LAYOVER_MIN);
    expect(a.approximate).toBe(true);
  });

  it('a 30h short-haul monster (1000mi, 1 stop) is too-long — multi-day sit, not a stopover', () => {
    const a = classifyDayTrip({ travelMinutes: 1800, distanceMiles: 1000, transfers: 1 });
    expect(a.kind).toBe('too-long');
  });

  it('an interval straddling the 6h floor is ambiguous — NOT advertised', () => {
    // 4000mi 1-stop, 18h one-way: slack ≈ 5.7h-10h, straddles 6h → conservative refusal.
    const a = classifyDayTrip({ travelMinutes: 1080, distanceMiles: 4000, transfers: 1 });
    expect(a.kind).toBe('ambiguous');
  });

  it('2-stop itineraries are never sold as day trips, even with big slack', () => {
    const a = classifyDayTrip({ travelMinutes: 1500, distanceMiles: 4000, transfers: 2 });
    expect(a.kind).not.toBe('day-trip');
  });

  it('round-trip wall durations classify via the split (40h RT long-haul → day-trip window)', () => {
    const a = classifyDayTrip({
      travelMinutes: 2700,
      distanceMiles: 4000,
      transfers: 1,
      travelMinutesAreRoundTrip: true,
    });
    expect(a.kind).toBe('day-trip');
  });
});

describe('exceedsMaxLayover — only hide confident violators', () => {
  it('unknown data is always kept', () => {
    expect(exceedsMaxLayover({ travelMinutes: null, distanceMiles: 4000, transfers: 1 }, 8)).toBe(false);
    expect(exceedsMaxLayover({}, 8)).toBe(false);
  });

  it('nonstop never exceeds a layover cap', () => {
    expect(exceedsMaxLayover({ travelMinutes: 540, distanceMiles: 4000, transfers: 0 }, 1)).toBe(false);
  });

  it('keeps a deal whose layover MIGHT exceed the cap but is not certain to', () => {
    // 4000mi 1-stop 20h: layover ≈ 7.7h-12h. Cap 8h → lower bound under cap → keep.
    expect(exceedsMaxLayover({ travelMinutes: 1200, distanceMiles: 4000, transfers: 1 }, 8)).toBe(false);
  });

  it('hides a deal whose layover certainly exceeds the cap (overnight sit)', () => {
    // 1000mi 1-stop 30h: layover lower bound ≈ 25.7h. Cap 8h → hide.
    expect(exceedsMaxLayover({ travelMinutes: 1800, distanceMiles: 1000, transfers: 1 }, 8)).toBe(true);
  });

  it('a disabled/invalid cap hides nothing', () => {
    expect(exceedsMaxLayover({ travelMinutes: 1800, distanceMiles: 1000, transfers: 1 }, 0)).toBe(false);
    expect(exceedsMaxLayover({ travelMinutes: 1800, distanceMiles: 1000, transfers: 1 }, NaN)).toBe(false);
  });
});

describe('exceedsMaxTravelTime', () => {
  it('compares round-trip wall durations against 2× the one-way cap', () => {
    expect(exceedsMaxTravelTime(2900, 24)).toBe(true); // 2900 > 2880
    expect(exceedsMaxTravelTime(2800, 24)).toBe(false);
  });

  it('one-way durations compare against the cap directly', () => {
    expect(exceedsMaxTravelTime(1500, 24, false)).toBe(true);
    expect(exceedsMaxTravelTime(1400, 24, false)).toBe(false);
  });

  it('unknown duration and disabled cap are always kept', () => {
    expect(exceedsMaxTravelTime(null, 24)).toBe(false);
    expect(exceedsMaxTravelTime(undefined, 24)).toBe(false);
    expect(exceedsMaxTravelTime(5000, 0)).toBe(false);
  });
});
