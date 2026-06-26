/** HC #619 — distance-banded trip-duration realism tests. Pure unit, no network. */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_NIGHTS,
  LONG_STAY_THRESHOLD_NIGHTS,
  clampToConsumerCap,
  defaultProviderNightsWindow,
  durationBandForDistance,
  isLongStay,
  nightsBetween,
} from './duration-bands';

describe('durationBandForDistance', () => {
  it('short-haul <1500mi → 3–7 nights', () => {
    expect(durationBandForDistance(0)).toEqual({ id: 'short', minNights: 3, maxNights: 7 });
    expect(durationBandForDistance(1499)).toEqual({ id: 'short', minNights: 3, maxNights: 7 });
  });
  it('medium-haul 1500–4000mi → 5–10 nights', () => {
    expect(durationBandForDistance(1500)).toEqual({ id: 'medium', minNights: 5, maxNights: 10 });
    expect(durationBandForDistance(3999)).toEqual({ id: 'medium', minNights: 5, maxNights: 10 });
  });
  it('long-haul 4000–7000mi → 7–14 nights', () => {
    expect(durationBandForDistance(4000)).toEqual({ id: 'long', minNights: 7, maxNights: 14 });
    expect(durationBandForDistance(6999)).toEqual({ id: 'long', minNights: 7, maxNights: 14 });
  });
  it('ultra-long-haul >7000mi → 10–21 nights', () => {
    expect(durationBandForDistance(7000)).toEqual({ id: 'ultra', minNights: 10, maxNights: 21 });
    expect(durationBandForDistance(15_000)).toEqual({ id: 'ultra', minNights: 10, maxNights: 21 });
  });
});

describe('clampToConsumerCap', () => {
  it('caps any window at the 30-night hard cap', () => {
    expect(clampToConsumerCap(7, 60)).toEqual({ min: 7, max: DEFAULT_MAX_NIGHTS });
    expect(clampToConsumerCap(45, 90)).toEqual({ min: DEFAULT_MAX_NIGHTS, max: DEFAULT_MAX_NIGHTS });
  });
  it('passes through windows already within cap', () => {
    expect(clampToConsumerCap(3, 14)).toEqual({ min: 3, max: 14 });
  });
});

describe('isLongStay', () => {
  it('flags >30-night trips as long stay', () => {
    expect(isLongStay(31)).toBe(true);
    expect(isLongStay(60)).toBe(true);
  });
  it('does not flag trips at or below 30 nights', () => {
    expect(isLongStay(LONG_STAY_THRESHOLD_NIGHTS)).toBe(false);
    expect(isLongStay(7)).toBe(false);
  });
  it('returns false for null/undefined', () => {
    expect(isLongStay(null)).toBe(false);
    expect(isLongStay(undefined)).toBe(false);
  });
});

describe('nightsBetween', () => {
  it('counts whole UTC nights between two yyyy-mm-dd strings', () => {
    expect(nightsBetween('2026-07-14', '2026-07-21')).toBe(7);
    expect(nightsBetween('2026-07-14', '2026-08-13')).toBe(30);
    expect(nightsBetween('2026-07-14', '2026-09-13')).toBe(61);
  });
  it('returns null on missing/malformed input', () => {
    expect(nightsBetween(null, '2026-07-21')).toBeNull();
    expect(nightsBetween('2026-07-14', null)).toBeNull();
    expect(nightsBetween('bad', '2026-07-21')).toBeNull();
  });
  it('returns null when return precedes depart (bad data)', () => {
    expect(nightsBetween('2026-07-21', '2026-07-14')).toBeNull();
  });
});

describe('defaultProviderNightsWindow', () => {
  it('returns the 3–14 default window for "anywhere" queries', () => {
    expect(defaultProviderNightsWindow()).toEqual({ min: 3, max: 14 });
  });
});
