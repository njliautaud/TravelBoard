import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findAirport,
  INTERNATIONAL_AIRPORTS,
} from "@travelboard/core";
import { alpha2ToAlpha3 } from "@/lib/countryCodes";
import { countryNameToISO2 } from "@/lib/api-utils";

/**
 * GET /api/deals/routes?origin=MCO&limit=20&country=JPN
 * Returns top deal routes with origin and destination coordinates
 * for rendering flight arc paths on the map. Includes both cash and award routes.
 *
 * When `country` (ISO-3 code) is provided, filters results to airports in that country.
 */
export async function GET(req: NextRequest) {
  const originFilter = req.nextUrl.searchParams.get("origin")?.toUpperCase();
  const countryFilter = req.nextUrl.searchParams.get("country")?.toUpperCase() ?? null;
  const limitStr = req.nextUrl.searchParams.get("limit");
  const defaultLimit = countryFilter ? 50 : 20;
  const limit = limitStr ? parseInt(limitStr, 10) : defaultLimit;

  // When filtering by country, build the set of airport IATA codes in that country.
  // We reverse-map ISO-3 → country name by scanning the ALPHA2_TO_ALPHA3 table and the airports.
  let countryAirportCodes: Set<string> | null = null;
  if (countryFilter) {
    // Collect all unique country names for airports whose country maps to this ISO-3 code
    const matchingCountryNames = new Set<string>();
    for (const airport of INTERNATIONAL_AIRPORTS) {
      const cc2 = countryNameToISO2(airport.country);
      const cc3 = cc2 ? alpha2ToAlpha3(cc2) : null;
      if (cc3 === countryFilter) {
        matchingCountryNames.add(airport.country);
      }
    }
    // Now collect all airport IATA codes for those country names
    countryAirportCodes = new Set<string>();
    for (const airport of INTERNATIONAL_AIRPORTS) {
      if (matchingCountryNames.has(airport.country)) {
        countryAirportCodes.add(airport.iata);
      }
    }
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const where: Record<string, unknown> = {
      lastSeen: { gte: sevenDaysAgo },
    };
    if (originFilter) where.origin = originFilter;
    // When filtering by country, restrict flyToCode to airports in that country
    if (countryAirportCodes && countryAirportCodes.size > 0) {
      where.flyToCode = { in: [...countryAirportCodes] };
    }

    const fares = await prisma.fareCache.findMany({
      where,
      orderBy: { price: "asc" },
      take: Math.min(limit, 100),
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

        const price = Number(f.price);
        const tier = f.tier ?? (price < 200 ? "cheap" : price < 500 ? "fair" : "splurge");
        return {
          origin: f.origin,
          destination: f.flyToCode,
          destCity: f.destination,
          price,
          dealScore: f.dealScore ?? 0.5,
          tier,
          originLat: originAirport.lat,
          originLon: originAirport.lon,
          destLat: destAirport.lat,
          destLon: destAirport.lon,
          isAward: false,
        };
      })
      .filter(Boolean);

    // Add award routes from AwardCache (DB) instead of live API
    let awardRoutes: typeof cashRoutes = [];
    if (originFilter) {
      try {
        const now = new Date();
        const awardWhere: Record<string, unknown> = {
          origin: originFilter,
          expiresAt: { gt: now },
          homeAnchored: true,
        };
        // Filter by country airports if applicable
        if (countryAirportCodes && countryAirportCodes.size > 0) {
          awardWhere.destination = { in: [...countryAirportCodes] };
        }

        const cached = await prisma.awardCache.findMany({
          where: awardWhere,
          orderBy: { score: "desc" },
          take: 10,
        });

        awardRoutes = cached.map((row) => {
          const originAirport = findAirport(row.origin);
          return {
            origin: row.origin,
            destination: row.destination,
            destCity: row.destCity ?? row.destination,
            price: row.miles,
            dealScore: row.score != null ? Math.min(row.score / 2, 1) : 0,
            tier: (row.score ?? 0) >= 1.5 ? "cheap" : (row.score ?? 0) >= 1.2 ? "fair" : "splurge",
            originLat: originAirport?.lat ?? 0,
            originLon: originAirport?.lon ?? 0,
            destLat: row.destLat ?? 0,
            destLon: row.destLon ?? 0,
            isAward: true,
          };
        });
      } catch {
        // Award cache read failed — serve cash routes only
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
      .slice(0, Math.min(limit, 100));

    return NextResponse.json({ routes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// countryNameToISO2 imported from @/lib/api-utils (shared mapping)
