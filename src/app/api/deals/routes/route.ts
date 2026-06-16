import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/deals/routes?origin=MCO&limit=20
 * Returns top deal routes with origin and destination coordinates
 * for rendering flight arc paths on the map.
 */
export async function GET(req: NextRequest) {
  const originFilter = req.nextUrl.searchParams.get("origin")?.toUpperCase();
  const limitStr = req.nextUrl.searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 20;

  try {
    const { findAirport } = await import("@travelboard/core");

    const where: Record<string, unknown> = { dealScore: { gte: 0.15 } };
    if (originFilter) where.origin = originFilter;

    const fares = await prisma.fareCache.findMany({
      where,
      orderBy: { dealScore: "desc" },
      take: Math.min(limit, 50),
      select: {
        origin: true,
        flyToCode: true,
        destination: true,
        price: true,
        dealScore: true,
        tier: true,
      },
    });

    const routes = fares
      .map((f) => {
        const originAirport = findAirport(f.origin);
        const destAirport = findAirport(f.flyToCode);
        if (!originAirport || !destAirport) return null;

        return {
          origin: f.origin,
          destination: f.flyToCode,
          destCity: f.destination,
          price: Number(f.price),
          dealScore: f.dealScore,
          tier: f.tier,
          originLat: originAirport.lat,
          originLon: originAirport.lon,
          destLat: destAirport.lat,
          destLon: destAirport.lon,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ routes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
