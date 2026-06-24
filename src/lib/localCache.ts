import type { LocationItem } from "./types";

/**
 * Best-effort client-side cache of a board's wishes in localStorage, for instant
 * first paint (stale-while-revalidate). The dataset is small (markers + a few
 * URLs), so localStorage is plenty and far simpler than IndexedDB. Every access
 * is wrapped — a full quota, private-mode, or disabled-storage error must never
 * break the app; it just falls back to the network.
 */

const VERSION = "v1";
const keyFor = (boardUserId: string) => `tb:cache:${VERSION}:locations:${boardUserId}`;
const LAST_BOARD_KEY = `tb:cache:${VERSION}:lastBoard`;
// Don't try to cache absurdly large boards (avoids thrashing the quota).
const MAX_CACHE_BYTES = 3_000_000;

/** Remember whose own-board was last cached, for an instant pre-auth boot paint. */
export function writeLastBoardId(boardUserId: string): void {
  if (typeof window === "undefined" || !boardUserId) return;
  try {
    window.localStorage.setItem(LAST_BOARD_KEY, boardUserId);
  } catch {
    /* ignore */
  }
}

export function readLastBoardId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_BOARD_KEY);
  } catch {
    return null;
  }
}

/** Read a cached board for instant render. Returns null on miss or any error. */
export function readCachedLocations(boardUserId: string): LocationItem[] | null {
  if (typeof window === "undefined" || !boardUserId) return null;
  try {
    const raw = window.localStorage.getItem(keyFor(boardUserId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocationItem[]) : null;
  } catch {
    return null;
  }
}

/** Persist a board locally. Silently no-ops if storage is unavailable or full. */
export function writeCachedLocations(boardUserId: string, locations: LocationItem[]): void {
  if (typeof window === "undefined" || !boardUserId) return;
  try {
    const json = JSON.stringify(locations);
    if (json.length > MAX_CACHE_BYTES) return; // too big to cache safely
    window.localStorage.setItem(keyFor(boardUserId), json);
  } catch {
    // Quota exceeded / private mode / disabled — drop this key and move on.
    try {
      window.localStorage.removeItem(keyFor(boardUserId));
    } catch {
      /* ignore */
    }
  }
}

export function clearCachedLocations(boardUserId: string): void {
  if (typeof window === "undefined" || !boardUserId) return;
  try {
    window.localStorage.removeItem(keyFor(boardUserId));
  } catch {
    /* ignore */
  }
}
