import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findAirport,
  SeatsAeroBulkAdapter,
  generateAwardDeals,
  VACATION_CODES,
} from "@travelboard/core";

/**
 * GET /api/deals/routes?origin=MCO&limit=20
 * Returns top deal routes with origin and destination coordinates
 * for rendering flight arc paths on the map. Includes both cash and award routes.
 */
export async function GET(req: NextRequest) {
  const originFilter = req.nextUrl.searchParams.get("origin")?.toUpperCase();
  const limitStr = req.nextUrl.searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 20;

  try {
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

    const cashRoutes = fares
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
          isAward: false,
        };
      })
      .filter(Boolean);

    // Add award routes if seats.aero is configured
    let awardRoutes: typeof cashRoutes = [];
    const apiKey = process.env.SEATSAERO_API_KEY;
    if (apiKey && originFilter) {
      try {
        const adapter = new SeatsAeroBulkAdapter({ apiKey });
        const records = await adapter.fetch();
        const vacationSet = new Set(VACATION_CODES);
        const awards = generateAwardDeals(records, {
          resolveAirport: (code: string) => findAirport(code),
          vacationCodes: vacationSet,
          homeAirport: originFilter,
          limit: 10,
        });

        awardRoutes = awards
          .filter((a) => a.homeAnchored)
          .map((a) => {
            const originAirport = findAirport(a.flyFrom);
            return {
              origin: a.flyFrom,
              destination: a.flyTo,
              destCity: a.cityTo,
              price: a.miles,
              dealScore: Math.min(a.score / 2, 1),
              tier: a.score >= 1.5 ? "cheap" : a.score >= 1.2 ? "fair" : "splurge",
              originLat: originAirport?.lat ?? 0,
              originLon: originAirport?.lon ?? 0,
              destLat: a.lat,
              destLon: a.lon,
              isAward: true,
            };
          });
      } catch {
        // Award routes unavailable — serve cash routes only
      }
    }

    // Deduplicate by destination, keeping the one with higher dealScore
    const routeMap = new Map<string, NonNullable<(typeof cashRoutes)[number]>>();
    for (const r of [...cashRoutes, ...awardRoutes]) {
      if (!r) continue;
      const key = `${r.origin}-${r.destination}`;
      const existing = routeMap.get(key);
      if (!existing || (r.dealScore ?? 0) > (existing.dealScore ?? 0)) {
        routeMap.set(key, r);
      }
    }

    const routes = [...routeMap.values()]
      .sort((a, b) => (b.dealScore ?? 0) - (a.dealScore ?? 0))
      .slice(0, Math.min(limit, 50));

    return NextResponse.json({ routes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
