/**
 * Fare tiering — maps a fare to an affordability tier that drives the board's tint.
 * cheap = teal, fair = amber, splurge = coral. Tiers are RELATIVE TO THE USER'S BUDGET so the map
 * re-tints live as the budget slider moves. (Reconcile thresholds with prototype/travelboard.html.)
 */

import type { FareTier, TieredFare } from '../types';
import type { FareQuote } from '../providers/types';

/** The board palette. */
export const TIER_COLORS: Record<FareTier, string> = {
  cheap: '#2dd4bf', // teal
  fair: '#f59e0b', // amber
  splurge: '#fb7185', // coral
};

export interface TieringOptions {
  /**
   * OPTIONAL user budget (USD). When provided, fares at/below `cheapFraction*budget` are cheap;
   * ≤ budget are fair; > budget are splurge. When OMITTED (HC 2026-06-04: budget removed from UI),
   * tiering falls back to PERCENTILE-RELATIVE buckets so the map still has a meaningful colour
   * gradient driven purely by the price distribution of the returned set.
   */
  budget?: number;
  cheapFraction?: number; // default 0.6
  /** how many of the cheapest fares to halo as "best deals" */
  bestDealCount?: number; // default 5
}

export function tierForPrice(
  price: number,
  budget: number,
  cheapFraction = 0.6,
): FareTier {
  if (price <= budget * cheapFraction) return 'cheap';
  if (price <= budget) return 'fair';
  return 'splurge';
}

/**
 * Percentile-based tier fallback used when no budget is supplied. Bottom third = cheap,
 * middle third = fair, top third = splurge. Driven by the price distribution of the input set.
 */
function tierByPercentile(price: number, sortedPrices: number[]): FareTier {
  if (sortedPrices.length === 0) return 'fair';
  const lo = sortedPrices[Math.floor(sortedPrices.length / 3)] ?? sortedPrices[0]!;
  const hi = sortedPrices[Math.floor((2 * sortedPrices.length) / 3)] ?? sortedPrices[sortedPrices.length - 1]!;
  if (price <= lo) return 'cheap';
  if (price <= hi) return 'fair';
  return 'splurge';
}

/**
 * Annotate a list of fares with tier + best-deal halo.
 * - With budget: best deals = N cheapest within budget; tiers are absolute thresholds.
 * - Without budget: best deals = N cheapest overall; tiers are percentile buckets.
 */
export function tierFares(fares: FareQuote[], opts: TieringOptions = {}): Map<string, TieredFare> {
  const { budget, cheapFraction = 0.6, bestDealCount = 5 } = opts;
  const out = new Map<string, TieredFare>();

  if (budget != null) {
    const bestDealCodes = new Set(
      [...fares]
        .filter((f) => f.price <= budget)
        .sort((a, b) => a.price - b.price)
        .slice(0, bestDealCount)
        .map((f) => f.flyTo),
    );
    for (const f of fares) {
      out.set(f.flyTo, {
        tier: tierForPrice(f.price, budget, cheapFraction),
        isBestDeal: bestDealCodes.has(f.flyTo),
      });
    }
    return out;
  }

  // No-budget path: percentile tiering + N cheapest overall as best deals.
  const sortedPrices = [...fares].map((f) => f.price).sort((a, b) => a - b);
  const bestDealCodes = new Set(
    [...fares]
      .sort((a, b) => a.price - b.price)
      .slice(0, bestDealCount)
      .map((f) => f.flyTo),
  );
  for (const f of fares) {
    out.set(f.flyTo, {
      tier: tierByPercentile(f.price, sortedPrices),
      isBestDeal: bestDealCodes.has(f.flyTo),
    });
  }
  return out;
}
