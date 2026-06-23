import { NextRequest, NextResponse } from "next/server";
import { smartFetch } from "@/lib/services/search-cache";

/**
 * GET /api/fares?origin=MCO&month=6
 *
 * Returns fares for an origin + month. Uses the smart cache layer:
 * - If another user searched the same origin+month recently, returns cached
 *   results instantly (no API call).
 * - If cache is stale, serves stale data immediately + triggers a background
 *   refresh so the next request gets fresh data.
 * - If no cache exists, fetches from provider and caches for future users.
 *
 * Response includes cache metadata:
 *   fromCache   - true if served from cache without API call
 *   refreshing  - true if a background refresh was triggered
 *   cacheAgeSec - how old the cached data is in seconds
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin");
  const monthStr = req.nextUrl.searchParams.get("month");

  if (!origin) {
    return NextResponse.json({ error: "origin is required" }, { status: 400 });
  }

  const month = monthStr != null ? parseInt(monthStr, 10) : new Date().getMonth();
  if (isNaN(month) || month < 0 || month > 11) {
    return NextResponse.json({ error: "month must be 0-11" }, { status: 400 });
  }

  try {
    const result = await smartFetch(origin.toUpperCase(), month);

    // Set cache headers so CDN / browser can also cache
    const headers = new Headers();
    if (!result.stale) {
      // Fresh data — cache for 5 minutes at the edge
      headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    } else {
      // Stale data — don't cache at edge, let the next request trigger refresh
      headers.set("Cache-Control", "public, s-maxage=0, stale-while-revalidate=300");
    }

    return NextResponse.json(result, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
