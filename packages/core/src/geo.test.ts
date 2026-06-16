import { describe, it, expect } from 'vitest';
import {
  haversineMiles,
  greatCirclePoints,
  interpolateGreatCircle,
  project,
  subsolarPoint,
  isDaylight,
} from './geo.js';

describe('haversineMiles', () => {
  it('is zero for identical points', () => {
    expect(haversineMiles({ lat: 10, lon: 20 }, { lat: 10, lon: 20 })).toBeCloseTo(0, 6);
  });
  it('matches a known distance (JFK→LHR ≈ 3450 mi)', () => {
    const d = haversineMiles({ lat: 40.64, lon: -73.78 }, { lat: 51.47, lon: -0.46 });
    expect(d).toBeGreaterThan(3300);
    expect(d).toBeLessThan(3600);
  });
});

describe('greatCirclePoints', () => {
  it('returns steps+1 points starting and ending at the endpoints', () => {
    const a = { lat: 0, lon: 0 };
    const b = { lat: 0, lon: 90 };
    const pts = greatCirclePoints(a, b, 8);
    expect(pts).toHaveLength(9);
    expect(pts[0]!.lon).toBeCloseTo(0, 4);
    expect(pts[8]!.lon).toBeCloseTo(90, 4);
  });
});

describe('interpolateGreatCircle', () => {
  it('midpoint of an equatorial segment sits near the equator', () => {
    const mid = interpolateGreatCircle({ lat: 0, lon: 0 }, { lat: 0, lon: 80 }, 0.5);
    expect(Math.abs(mid.lat)).toBeLessThan(1);
  });
});

describe('project', () => {
  it('maps lon/lat to the pixel rectangle', () => {
    expect(project({ lat: 0, lon: 0 }, 1000, 500)).toEqual({ x: 500, y: 250 });
    expect(project({ lat: 90, lon: -180 }, 1000, 500)).toEqual({ x: 0, y: 0 });
  });
});

describe('terminator', () => {
  it('subsolar point latitude stays within the tropics', () => {
    const sun = subsolarPoint(new Date('2026-06-21T12:00:00Z'));
    expect(sun.lat).toBeGreaterThan(20); // near the Tropic of Cancer at solstice
    expect(sun.lat).toBeLessThan(24);
  });
  it('the subsolar point itself is in daylight', () => {
    const sun = subsolarPoint(new Date('2026-03-20T12:00:00Z'));
    expect(isDaylight(sun, sun)).toBe(true);
  });
});
