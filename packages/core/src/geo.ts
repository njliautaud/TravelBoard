/** Pure geo math — no DOM, safe to import anywhere (api, board, mobile). */

import type { GeoPoint } from './types';

export const EARTH_RADIUS_MILES = 3958.8;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** Great-circle distance between two lat/lon points, in miles. */
export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const dLat = (b.lat - a.lat) * DEG2RAD;
  const dLon = (b.lon - a.lon) * DEG2RAD;
  const lat1 = a.lat * DEG2RAD;
  const lat2 = b.lat * DEG2RAD;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Sample `steps`+1 points along the great-circle path from a→b (for drawing arcs).
 * Uses spherical linear interpolation (slerp) of the unit vectors.
 */
export function greatCirclePoints(a: GeoPoint, b: GeoPoint, steps = 64): GeoPoint[] {
  const φ1 = a.lat * DEG2RAD;
  const λ1 = a.lon * DEG2RAD;
  const φ2 = b.lat * DEG2RAD;
  const λ2 = b.lon * DEG2RAD;

  const x1 = Math.cos(φ1) * Math.cos(λ1);
  const y1 = Math.cos(φ1) * Math.sin(λ1);
  const z1 = Math.sin(φ1);
  const x2 = Math.cos(φ2) * Math.cos(λ2);
  const y2 = Math.cos(φ2) * Math.sin(λ2);
  const z2 = Math.sin(φ2);

  const dot = Math.min(1, Math.max(-1, x1 * x2 + y1 * y2 + z1 * z2));
  const ω = Math.acos(dot);
  const sinω = Math.sin(ω);

  const out: GeoPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let xi: number;
    let yi: number;
    let zi: number;
    if (sinω < 1e-9) {
      xi = x1;
      yi = y1;
      zi = z1;
    } else {
      const A = Math.sin((1 - t) * ω) / sinω;
      const B = Math.sin(t * ω) / sinω;
      xi = A * x1 + B * x2;
      yi = A * y1 + B * y2;
      zi = A * z1 + B * z2;
    }
    const lat = Math.atan2(zi, Math.sqrt(xi * xi + yi * yi)) * RAD2DEG;
    const lon = Math.atan2(yi, xi) * RAD2DEG;
    out.push({ lat, lon });
  }
  return out;
}

/** Interpolate a fraction `t` (0–1) along the great circle a→b. */
export function interpolateGreatCircle(a: GeoPoint, b: GeoPoint, t: number): GeoPoint {
  const pts = greatCirclePoints(a, b, 128);
  const idx = Math.min(pts.length - 1, Math.max(0, Math.round(t * (pts.length - 1))));
  return pts[idx]!;
}

/**
 * Equirectangular projection: lon/lat → x/y in a w×h pixel rectangle (lon −180..180 → 0..w,
 * lat 90..−90 → 0..h). This is the board's map projection. (Reconcile with travelboard.html.)
 */
export function project(
  point: GeoPoint,
  width: number,
  height: number,
): { x: number; y: number } {
  const x = ((point.lon + 180) / 360) * width;
  const y = ((90 - point.lat) / 180) * height;
  return { x, y };
}

/**
 * The subsolar point (where the sun is directly overhead) for a given UTC time — drives the
 * Ambient mode day/night terminator. Approximate (good enough for ambient art).
 */
export function subsolarPoint(date: Date): GeoPoint {
  // Day of year
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start) / 86400000);
  // Solar declination (approx, degrees)
  const decl = -23.44 * Math.cos(DEG2RAD * (360 / 365) * (dayOfYear + 10));
  // Subsolar longitude from UTC time (sun over 0° at solar noon UTC ≈ 12:00)
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const lon = -15 * (utcHours - 12);
  return { lat: decl, lon };
}

/** True if a point is currently in daylight given the subsolar point. */
export function isDaylight(point: GeoPoint, subsolar: GeoPoint): boolean {
  const φ = point.lat * DEG2RAD;
  const δ = subsolar.lat * DEG2RAD;
  const h = (point.lon - subsolar.lon) * DEG2RAD;
  const elevation = Math.asin(
    Math.sin(φ) * Math.sin(δ) + Math.cos(φ) * Math.cos(δ) * Math.cos(h),
  );
  return elevation > 0;
}
