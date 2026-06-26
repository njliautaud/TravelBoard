import { describe, it, expect } from 'vitest';
import { hash01, seasonalFactor, estimateFare } from './model';
import { findDestination } from '../data/destinations';

describe('hash01', () => {
  it('is deterministic', () => {
    expect(hash01('LIS:6')).toBe(hash01('LIS:6'));
  });
  it('returns a value in [0,1)', () => {
    for (const s of ['a', 'LIS:0', 'NRT:11', 'xyz']) {
      const v = hash01(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('varies across inputs', () => {
    expect(hash01('LIS:6')).not.toBe(hash01('LIS:7'));
  });
});

describe('seasonalFactor', () => {
  it('peaks at the peak month', () => {
    const atPeak = seasonalFactor(6, 6);
    const offPeak = seasonalFactor(0, 6);
    expect(atPeak).toBeGreaterThan(offPeak);
  });
  it('is symmetric around the peak', () => {
    expect(seasonalFactor(5, 6)).toBeCloseTo(seasonalFactor(7, 6), 10);
  });
});

describe('estimateFare', () => {
  const mco = { lat: 28.43, lon: -81.31 };
  const lisbon = findDestination('LIS')!;

  it('is deterministic for the same inputs', () => {
    const a = estimateFare(mco, lisbon, 6);
    const b = estimateFare(mco, lisbon, 6);
    expect(a).toEqual(b);
  });

  it('produces a positive price and distance', () => {
    const { price, distance } = estimateFare(mco, lisbon, 6);
    expect(price).toBeGreaterThan(0);
    expect(distance).toBeGreaterThan(1000); // MCO→LIS is several thousand miles
  });

  it('farther destinations cost more on average than near ones', () => {
    const cancun = findDestination('CUN')!; // close to MCO
    const tokyo = findDestination('NRT')!; // far
    expect(estimateFare(mco, tokyo, 6).price).toBeGreaterThan(
      estimateFare(mco, cancun, 6).price,
    );
  });

  it('peak-month fares are >= off-peak for the same destination', () => {
    const peak = estimateFare(mco, lisbon, lisbon.peakMonth).price;
    const off = estimateFare(mco, lisbon, (lisbon.peakMonth + 6) % 12).price;
    expect(peak).toBeGreaterThanOrEqual(off);
  });
});
