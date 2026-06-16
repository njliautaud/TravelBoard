/**
 * Fare service layer — ported from Meridian's fares.ts.
 *
 * Uses Prisma (PostgreSQL) instead of Drizzle/SQLite. The cache stores the full
 * destination set per (origin, month). Client reads are always from cache; only
 * `warmCache()` calls the provider.
 */

import { prisma } from "@/lib/prisma";
import {
  findAirport,
  type FareQuote,
  type FlightProvider,
} from "@travelboard/core";
import { Decimal } from "@prisma/client/runtime/library";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FaresResult {
  origin: string;
  month: number;
  fares: CachedFare[];
  fetchedAt: string | null;
  stale: boolean;
}

export interface CachedFare {
  id: string;
  origin: string;
  destination: string;
  flyToCode: string;
  month: number;
  outboundDate: string | null;
  returnDate: string | null;
  price: number;
  currency: string;
  airline: string | null;
  source: string | null;
  dealScore: number | null;
  tier: string | null;
  lastSeen: string;
}

export interface HistoryPoint {
  price: number;
  source: string | null;
  recordedAt: string;
}

export interface TopDeal extends CachedFare {
  savingsPercent: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function decimalToNumber(d: Decimal | null | undefined): number | null {
  if (d == null) return null;
  return Number(d);
}

function rowToCachedFare(r: {
  id: string;
  origin: string;
  destination: string;
  flyToCode: string;
  month: number;
  outboundDate: Date | null;
  returnDate: Date | null;
  price: Decimal;
  currency: string;
  airline: string | null;
  source: string | null;
  dealScore: number | null;
  tier: string | null;
  lastSeen: Date;
}): CachedFare {
  return {
    id: r.id,
    origin: r.origin,
    destination: r.destination,
    flyToCode: r.flyToCode,
    month: r.month,
    outboundDate: r.outboundDate?.toISOString() ?? null,
    returnDate: r.returnDate?.toISOString() ?? null,
    price: Number(r.price),
    currency: r.currency,
    airline: r.airline,
    source: r.source,
    dealScore: r.dealScore,
    tier: r.tier,
    lastSeen: r.lastSeen.toISOString(),
  };
}

/** Trimmed-median estimate of a numeric array. */
function trimmedMedian(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * 0.1);
  const inner = sorted.slice(cut, sorted.length - cut);
  if (!inner.length) return sorted[Math.floor(sorted.length / 2)] ?? null;
  const mid = Math.floor(inner.length / 2);
  if (inner.length % 2 === 0) {
    return Math.round(((inner[mid - 1] ?? 0) + (inner[mid] ?? 0)) / 2);
  }
  return inner[mid] ?? null;
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

/**
 * Read cached fares for an origin + month. Pure DB read, never calls a provider.
 */
export async function getCachedFares(
  origin: string,
  month: number,
): Promise<FaresResult> {
  const rows = await prisma.fareCache.findMany({
    where: { origin, month },
    orderBy: { price: "asc" },
  });

  const fares = rows.map(rowToCachedFare);
  const newest = fares.length > 0 ? fares[0]!.lastSeen : null;
  const stale = newest
    ? Date.now() - new Date(newest).getTime() > CACHE_TTL_MS
    : true;

  return { origin, month, fares, fetchedAt: newest, stale };
}

/**
 * Rank cached fares by deal score and return the top N.
 */
export async function findTopDeals(
  origin?: string,
  limit = 25,
  minDealScore = 0.10,
): Promise<TopDeal[]> {
  const where: Record<string, unknown> = {};
  if (origin) where.origin = origin;
  where.dealScore = { gte: minDealScore };

  const rows = await prisma.fareCache.findMany({
    where,
    orderBy: { dealScore: "desc" },
    take: limit * 2, // over-fetch to filter
  });

  return rows
    .map((r) => {
      const fare = rowToCachedFare(r);
      const savingsPercent = fare.dealScore
        ? Math.round(fare.dealScore * 100)
        : 0;
      return { ...fare, savingsPercent };
    })
    .sort((a, b) => (b.dealScore ?? 0) - (a.dealScore ?? 0))
    .slice(0, limit);
}

/**
 * Get price history for a specific route.
 */
export async function getRouteHistory(
  origin: string,
  destination: string,
  days = 30,
): Promise<HistoryPoint[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.fareHistory.findMany({
    where: {
      origin,
      destination,
      recordedAt: { gte: since },
    },
    orderBy: { recordedAt: "asc" },
  });

  return rows.map((r) => ({
    price: Number(r.price),
    source: r.source,
    recordedAt: r.recordedAt.toISOString(),
  }));
}

/**
 * Compute rolling baseline for a route from history.
 */
async function computeBaseline(
  origin: string,
  destination: string,
): Promise<number | null> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows = await prisma.fareHistory.findMany({
    where: { origin, destination, recordedAt: { gte: since } },
    select: { price: true },
  });
  if (rows.length < 5) return null;
  return trimmedMedian(rows.map((r) => Number(r.price)));
}

/**
 * Warm the cache for an origin + month by querying the provider. This is the only
 * function that ever calls the flight provider.
 */
export async function warmCache(
  provider: FlightProvider,
  originCode: string,
  month: number,
): Promise<number> {
  const airport = findAirport(originCode);
  if (!airport) throw new Error(`Unknown origin airport: ${originCode}`);

  const fares: FareQuote[] = await provider.getCheapest({
    origin: { code: airport.code, lat: airport.lat, lon: airport.lon },
    month,
  });

  const observedAt = new Date();

  // Record history
  const historyData = fares.map((f) => ({
    origin: originCode,
    destination: f.flyTo,
    month,
    price: f.price,
    source: f.gate ?? f.source ?? null,
    recordedAt: observedAt,
  }));

  // Compute baselines and build cache rows
  const cacheData = await Promise.all(
    fares.map(async (f) => {
      const baseline = await computeBaseline(originCode, f.flyTo);
      const dealScore =
        baseline != null && baseline > 0
          ? Math.round(((baseline - f.price) / baseline) * 1000) / 1000
          : null;

      let tier: string | null = null;
      if (dealScore != null) {
        if (dealScore >= 0.30) tier = "cheap";
        else if (dealScore >= 0.10) tier = "fair";
        else tier = "splurge";
      }

      return {
        origin: originCode,
        destination: f.cityTo,
        flyToCode: f.flyTo,
        month,
        outboundDate: f.departDate ? new Date(f.departDate) : null,
        returnDate: f.returnDate ? new Date(f.returnDate) : null,
        price: f.price,
        currency: "USD",
        airline: f.gate ?? null,
        source: f.source ?? null,
        dealScore,
        tier,
        lastSeen: observedAt,
      };
    }),
  );

  // Transaction: delete old cache rows, insert new ones + history
  await prisma.$transaction([
    prisma.fareCache.deleteMany({ where: { origin: originCode, month } }),
    ...cacheData.map((row) => prisma.fareCache.create({ data: row })),
    ...historyData.map((row) => prisma.fareHistory.create({ data: row })),
  ]);

  return cacheData.length;
}
