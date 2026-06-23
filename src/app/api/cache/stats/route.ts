import { NextResponse } from "next/server";
import { getSearchCacheStats } from "@/lib/services/search-cache";

/**
 * GET /api/cache/stats
 *
 * Returns search cache statistics for monitoring.
 * Public endpoint — no auth needed (stats only, no sensitive data).
 */
export async function GET() {
  try {
    const stats = await getSearchCacheStats();
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
