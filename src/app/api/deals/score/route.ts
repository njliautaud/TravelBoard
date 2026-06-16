import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scoreDeal } from "@/lib/services/deal-scoring";


/**
 * GET /api/deals/score?origin=MCO&dest=CUN
 * Returns detailed deal score breakdown for a route.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin");
  const dest = req.nextUrl.searchParams.get("dest");

  if (!origin || !dest) {
    return NextResponse.json({ error: "origin and dest required" }, { status: 400 });
  }

  try {
    // Find the cheapest recent fare for this route
    const fare = await prisma.fareCache.findFirst({
      where: {
        origin: origin.toUpperCase(),
        flyToCode: dest.toUpperCase(),
      },
      orderBy: { lastSeen: "desc" },
    });

    if (!fare) {
      return NextResponse.json({ error: "No fare data" }, { status: 404 });
    }

    // Compute baseline from historical average
    const history = await prisma.fareHistory.findMany({
      where: {
        origin: origin.toUpperCase(),
        destination: dest.toUpperCase(),
      },
      orderBy: { recordedAt: "desc" },
      take: 30,
    });

    const baseline = history.length > 0
      ? Math.round(history.reduce((sum, h) => sum + Number(h.price), 0) / history.length)
      : null;

    const breakdown = scoreDeal({
      price: Number(fare.price),
      baseline,
      fetchedAt: fare.lastSeen.toISOString(),
      airline: fare.airline,
    });

    return NextResponse.json({
      flyTo: dest.toUpperCase(),
      totalScore: breakdown.totalScore,
      grade: breakdown.grade,
      factors: breakdown.factors,
      summary: breakdown.summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
