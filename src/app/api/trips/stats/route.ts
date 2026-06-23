import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { getTravelStats, getTripArcs } from "@/lib/services/trips";


/**
 * GET /api/trips/stats
 *
 * Auth: required.
 * Returns travel statistics (countries visited, continents, miles, trip arcs).
 *
 * Response: { stats: TravelStats, arcs: TripArc[] }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const [stats, arcs] = await Promise.all([
      getTravelStats(user.id),
      getTripArcs(user.id),
    ]);

    return NextResponse.json({ stats, arcs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
