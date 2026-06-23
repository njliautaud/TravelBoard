/**
 * Tests for the search-cache service — pure logic functions only.
 *
 * The service uses Prisma for persistence, but the helper functions
 * (makeCacheKey, isLocked, TTL logic) are pure and testable in isolation.
 * We replicate the logic here to verify correctness without a DB.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Replicate the pure helpers from search-cache.ts so we can test them
// without importing Prisma-dependent modules.
// ---------------------------------------------------------------------------

const FRESH_TTL_MS = 30 * 60 * 1000; // 30 minutes
const HARD_EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 hours
const LOCK_TIMEOUT_MS = 60 * 1000; // 60 seconds

function makeCacheKey(origin: string, month: number): string {
  return `${origin.toUpperCase()}:${month}`;
}

function isLocked(entry: {
  fetching: boolean;
  fetchLockAt: Date | null;
}): boolean {
  if (!entry.fetching) return false;
  if (!entry.fetchLockAt) return false;
  const lockAge = Date.now() - entry.fetchLockAt.getTime();
  return lockAge < LOCK_TIMEOUT_MS;
}

function isFresh(fetchedAt: Date): boolean {
  return Date.now() - fetchedAt.getTime() < FRESH_TTL_MS;
}

function isExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() <= Date.now();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("makeCacheKey", () => {
  it("uppercases the origin", () => {
    expect(makeCacheKey("mco", 6)).toBe("MCO:6");
  });

  it("preserves already-uppercase origin", () => {
    expect(makeCacheKey("JFK", 0)).toBe("JFK:0");
  });

  it("handles mixed case", () => {
    expect(makeCacheKey("lAx", 11)).toBe("LAX:11");
  });

  it("produces distinct keys for different months", () => {
    expect(makeCacheKey("MCO", 6)).not.toBe(makeCacheKey("MCO", 7));
  });

  it("produces distinct keys for different origins", () => {
    expect(makeCacheKey("MCO", 6)).not.toBe(makeCacheKey("JFK", 6));
  });

  it("handles month 0 (January)", () => {
    expect(makeCacheKey("MCO", 0)).toBe("MCO:0");
  });

  it("handles month 11 (December)", () => {
    expect(makeCacheKey("MCO", 11)).toBe("MCO:11");
  });
});

describe("isLocked", () => {
  it("returns false when not fetching", () => {
    expect(isLocked({ fetching: false, fetchLockAt: new Date() })).toBe(false);
  });

  it("returns false when fetching but no lock timestamp", () => {
    expect(isLocked({ fetching: true, fetchLockAt: null })).toBe(false);
  });

  it("returns true for a fresh lock (just acquired)", () => {
    expect(isLocked({ fetching: true, fetchLockAt: new Date() })).toBe(true);
  });

  it("returns true for a lock 30 seconds old (within timeout)", () => {
    const thirtySecsAgo = new Date(Date.now() - 30_000);
    expect(isLocked({ fetching: true, fetchLockAt: thirtySecsAgo })).toBe(true);
  });

  it("returns false for a zombie lock (>60s old)", () => {
    const twoMinutesAgo = new Date(Date.now() - 120_000);
    expect(isLocked({ fetching: true, fetchLockAt: twoMinutesAgo })).toBe(false);
  });

  it("returns false for a lock exactly at timeout boundary", () => {
    // At exactly LOCK_TIMEOUT_MS, lockAge === LOCK_TIMEOUT_MS, which is NOT < LOCK_TIMEOUT_MS
    const exactlyAtTimeout = new Date(Date.now() - LOCK_TIMEOUT_MS);
    expect(isLocked({ fetching: true, fetchLockAt: exactlyAtTimeout })).toBe(false);
  });
});

describe("cache TTL logic", () => {
  it("data fetched just now is fresh", () => {
    expect(isFresh(new Date())).toBe(true);
  });

  it("data fetched 15 minutes ago is still fresh", () => {
    expect(isFresh(new Date(Date.now() - 15 * 60 * 1000))).toBe(true);
  });

  it("data fetched 31 minutes ago is stale", () => {
    expect(isFresh(new Date(Date.now() - 31 * 60 * 1000))).toBe(false);
  });

  it("data with future expiresAt is not expired", () => {
    expect(isExpired(new Date(Date.now() + 60_000))).toBe(false);
  });

  it("data with past expiresAt is expired", () => {
    expect(isExpired(new Date(Date.now() - 1000))).toBe(true);
  });

  it("hard expiry is 6 hours after fetch", () => {
    const fetchedAt = new Date();
    const expiresAt = new Date(fetchedAt.getTime() + HARD_EXPIRY_MS);
    // Check that 5 hours later it's NOT expired
    const fiveHoursLater = new Date(fetchedAt.getTime() + 5 * 60 * 60 * 1000);
    expect(expiresAt.getTime() > fiveHoursLater.getTime()).toBe(true);
    // Check that 7 hours later it IS expired
    const sevenHoursLater = new Date(fetchedAt.getTime() + 7 * 60 * 60 * 1000);
    expect(expiresAt.getTime() < sevenHoursLater.getTime()).toBe(true);
  });

  it("stale window is between FRESH_TTL and HARD_EXPIRY", () => {
    // 45 minutes: stale but not expired
    const fetchedAt = new Date(Date.now() - 45 * 60 * 1000);
    const expiresAt = new Date(fetchedAt.getTime() + HARD_EXPIRY_MS);
    expect(isFresh(fetchedAt)).toBe(false);
    expect(isExpired(expiresAt)).toBe(false);
  });
});
