/**
 * SearchCache service — deduplicates flight API calls across users.
 *
 * When user A searches "MCO, July", we fetch from the provider and cache.
 * When user B searches the same thing 5 minutes later, they get the cached
 * result without burning another API call.
 *
 * Cache keys: "ORIGIN:MONTH" (e.g. "MCO:6")
 * Default TTL: 30 minutes for fresh data, 6 hours hard expiry
 * Stale-while-revalidate: returns stale data immediately while refreshing in background
 */

import { prisma } from "@/lib/prisma";
import { warmCache, getCachedFares, type FaresResult } from "./fares";
import { getFlightProvider } from "@/lib/providers";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** How long until cached data is considered "fresh" (no re-fetch needed) */
const FRESH_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Hard expiry — after this, data is too old to serve even as stale */
const HARD_EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Max time a fetch lock can be held before it's considered zombie */
const LOCK_TIMEOUT_MS = 60 * 1000; // 60 seconds

// ---------------------------------------------------------------------------
// Cache key helpers
// ---------------------------------------------------------------------------

function makeCacheKey(origin: string, month: number): string {
  return `${origin.toUpperCase()}:${month}`;
}

// ---------------------------------------------------------------------------
// Core: get-or-fetch with deduplication
// ---------------------------------------------------------------------------

export interface SmartFetchResult extends FaresResult {
  /** Whether this was served from cache without an API call */
  fromCache: boolean;
  /** Whether a background refresh was triggered */
  refreshing: boolean;
  /** Cache age in seconds */
  cacheAgeSec: number;
}

/**
 * Smart fetch: returns cached fares if fresh, otherwise fetches from provider.
 * Handles concurrent request deduplication so two users hitting the same
 * search simultaneously only trigger ONE API call.
 */
export async function smartFetch(
  origin: string,
  month: number,
): Promise<SmartFetchResult> {
  const key = makeCacheKey(origin, month);
  const now = new Date();

  // 1. Check the dedup cache
  const entry = await prisma.searchCache.findUnique({
    where: { cacheKey: key },
  });

  // 2. If we have a fresh entry, return cached data directly
  if (entry && entry.expiresAt > now) {
    const fetchedAt = entry.fetchedAt;
    const ageMs = now.getTime() - fetchedAt.getTime();
    const isFresh = ageMs < FRESH_TTL_MS;

    const cached = await getCachedFares(origin.toUpperCase(), month);

    if (isFresh || cached.fares.length > 0) {
      // If stale but not expired, trigger background refresh
      let refreshing = false;
      if (!isFresh && !isLocked(entry)) {
        // Fire and forget — don't await
        triggerBackgroundRefresh(origin, month, key).catch(() => {});
        refreshing = true;
      }

      return {
        ...cached,
        stale: !isFresh,
        fromCache: true,
        refreshing,
        cacheAgeSec: Math.round(ageMs / 1000),
      };
    }
  }

  // 3. No valid cache — need to fetch. But first check if someone else is
  //    already fetching (concurrent dedup).
  if (entry && isLocked(entry)) {
    // Another request is fetching right now. Wait briefly then return
    // whatever's in the fare cache (might be stale but better than nothing).
    await sleep(2000);
    const cached = await getCachedFares(origin.toUpperCase(), month);
    return {
      ...cached,
      fromCache: true,
      refreshing: true,
      cacheAgeSec: entry
        ? Math.round((now.getTime() - entry.fetchedAt.getTime()) / 1000)
        : 0,
    };
  }

  // 4. Acquire the fetch lock and do the API call
  const lockId = `${process.pid}-${Date.now()}`;
  try {
    await prisma.searchCache.upsert({
      where: { cacheKey: key },
      update: {
        fetching: true,
        fetchLockId: lockId,
        fetchLockAt: now,
      },
      create: {
        cacheKey: key,
        origin: origin.toUpperCase(),
        month,
        resultCount: 0,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + HARD_EXPIRY_MS),
        fetching: true,
        fetchLockId: lockId,
        fetchLockAt: now,
      },
    });

    // 5. Actually call the provider
    const provider = getFlightProvider();
    const count = await warmCache(provider, origin.toUpperCase(), month);

    // 6. Update the cache entry
    const fetchedAt = new Date();
    await prisma.searchCache.update({
      where: { cacheKey: key },
      data: {
        fetchedAt,
        expiresAt: new Date(fetchedAt.getTime() + HARD_EXPIRY_MS),
        resultCount: count,
        fetching: false,
        fetchLockId: null,
        fetchLockAt: null,
      },
    });

    // 7. Return fresh results
    const result = await getCachedFares(origin.toUpperCase(), month);
    return {
      ...result,
      stale: false,
      fromCache: false,
      refreshing: false,
      cacheAgeSec: 0,
    };
  } catch (err) {
    // Release the lock on failure
    await prisma.searchCache
      .update({
        where: { cacheKey: key },
        data: { fetching: false, fetchLockId: null, fetchLockAt: null },
      })
      .catch(() => {});

    // If we have stale data, serve it rather than failing
    const staleData = await getCachedFares(origin.toUpperCase(), month);
    if (staleData.fares.length > 0) {
      return {
        ...staleData,
        stale: true,
        fromCache: true,
        refreshing: false,
        cacheAgeSec: entry
          ? Math.round((now.getTime() - entry.fetchedAt.getTime()) / 1000)
          : 0,
      };
    }

    throw err;
  }
}

// ---------------------------------------------------------------------------
// Background refresh
// ---------------------------------------------------------------------------

async function triggerBackgroundRefresh(
  origin: string,
  month: number,
  key: string,
): Promise<void> {
  const lockId = `bg-${process.pid}-${Date.now()}`;
  const now = new Date();

  try {
    await prisma.searchCache.update({
      where: { cacheKey: key },
      data: {
        fetching: true,
        fetchLockId: lockId,
        fetchLockAt: now,
      },
    });

    const provider = getFlightProvider();
    const count = await warmCache(provider, origin.toUpperCase(), month);

    const fetchedAt = new Date();
    await prisma.searchCache.update({
      where: { cacheKey: key },
      data: {
        fetchedAt,
        expiresAt: new Date(fetchedAt.getTime() + HARD_EXPIRY_MS),
        resultCount: count,
        fetching: false,
        fetchLockId: null,
        fetchLockAt: null,
      },
    });
  } catch {
    await prisma.searchCache
      .update({
        where: { cacheKey: key },
        data: { fetching: false, fetchLockId: null, fetchLockAt: null },
      })
      .catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Cleanup: expire old entries
// ---------------------------------------------------------------------------

/**
 * Remove expired search cache entries. Call periodically (e.g. daily cron).
 */
export async function cleanupExpiredSearchCache(): Promise<number> {
  const result = await prisma.searchCache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

/**
 * Get cache stats for monitoring / admin dashboard.
 */
export async function getSearchCacheStats(): Promise<{
  totalEntries: number;
  freshEntries: number;
  staleEntries: number;
  activelyFetching: number;
}> {
  const now = new Date();
  const freshCutoff = new Date(now.getTime() - FRESH_TTL_MS);

  const [total, fresh, fetching] = await Promise.all([
    prisma.searchCache.count(),
    prisma.searchCache.count({
      where: { fetchedAt: { gte: freshCutoff }, expiresAt: { gt: now } },
    }),
    prisma.searchCache.count({ where: { fetching: true } }),
  ]);

  return {
    totalEntries: total,
    freshEntries: fresh,
    staleEntries: total - fresh,
    activelyFetching: fetching,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLocked(entry: {
  fetching: boolean;
  fetchLockAt: Date | null;
}): boolean {
  if (!entry.fetching) return false;
  if (!entry.fetchLockAt) return false;
  // Check for zombie locks
  const lockAge = Date.now() - entry.fetchLockAt.getTime();
  return lockAge < LOCK_TIMEOUT_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
