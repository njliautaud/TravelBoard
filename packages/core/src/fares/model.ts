/**
 * Deterministic mock fare model — ported in intent from the prototype's "distance + seasonal-sine"
 * model. Fully offline, no randomness at call time: identical inputs always yield identical prices.
 * (Reconcile exact constants with prototype/travelboard.html when available.)
 */

import type { Destination, GeoPoint } from '../types';
import { haversineMiles } from '../geo';

/** FNV-1a hash → deterministic float in [0, 1). Used for stable per-city jitter. */
export function hash01(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // >>> 0 to unsigned, divide by 2^32
  return (h >>> 0) / 0x100000000;
}

const BASE_FARE = 89; // fixed taxes/fees floor, USD (realistic for intl RT)
const PER_MILE = 0.082; // round-trip USD per great-circle mile
const SEASONAL_AMPLITUDE = 0.28; // ±28% around the seasonal mean
const JITTER_SPREAD = 0.18; // ±9% deterministic per-city wobble

/** Seasonal multiplier: most expensive at the destination's peakMonth, cheapest opposite it. */
export function seasonalFactor(month: number, peakMonth: number): number {
  const phase = (2 * Math.PI * (month - peakMonth)) / 12;
  return 1 + SEASONAL_AMPLITUDE * Math.cos(phase);
}

/**
 * Estimate a deterministic round-trip fare (USD) from an origin to a destination for a given month.
 * @param month 0–11
 */
export function estimateFare(
  origin: GeoPoint,
  dest: Destination,
  month: number,
): { price: number; distance: number } {
  const distance = Math.round(haversineMiles(origin, dest));
  const seasonal = seasonalFactor(month, dest.peakMonth);
  const jitter = 1 + (hash01(`${dest.code}:${month}`) - 0.5) * 2 * JITTER_SPREAD;
  const raw = (BASE_FARE + distance * PER_MILE) * seasonal * jitter;
  // Round to realistic airline price: cheap flights end in 7/9, expensive ones end in 9/99
  const rounded = Math.round(raw);

  let price: number;
  if (rounded < 300) {
    // Budget flights: nearest $5, ending in 7 or 9
    price = rounded - (rounded % 10) + (hash01(`${dest.code}:r`) > 0.5 ? 9 : 7);
  } else if (rounded < 800) {
    // Mid-range: round to nearest $10, end in 9
    price = rounded - (rounded % 10) + 9;
  } else {
    // Premium: round to nearest $50, end in 9 or 99
    const base50 = rounded - (rounded % 50);
    price = hash01(`${dest.code}:px`) > 0.5 ? base50 + 99 : base50 + 49;
  }
  price = Math.max(BASE_FARE, price);
  return { price, distance };
}
