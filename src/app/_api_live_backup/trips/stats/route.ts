import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getTravelStats, getTripArcs } from "@/lib/services/trips";


/**
 * GET /api/trips/stats — travel statistics (countries, continents, miles, arcs).
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [stats, arcs] = await Promise.all([
    getTravelStats(user.id),
    getTripArcs(user.id),
  ]);

  return NextResponse.json({ stats, arcs });
}
