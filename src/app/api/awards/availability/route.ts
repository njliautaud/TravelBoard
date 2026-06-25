import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/unified-auth";

/**
 * GET /api/awards/availability?origin=MCO&limit=50
 *
 * Returns award deals from the AwardCache (DB-persisted, refreshed via
 * POST /api/awards/refresh). Only returns non-expired entries.
 *
 * If no origin param is provided, falls back to the authenticated user's
 * homeAirports (first one), then to "MCO" as a last resort.
 *
 * Previously this hit seats.aero live on every request — now it reads
 * from the cached DB layer instead.
 */
export async function GET(req: NextRequest) {
  let origin = req.nextUrl.searchParams.get("origin")?.toUpperCase();

  // If no origin provided, try to use the authenticated user's homeAirports
  if (!origin) {
    try {
      const session = await getAuthUser();
      if (session) {
        const user = await prisma.user.findUnique({
          where: { id: session.id },
          select: { homeAirports: true, onboarded: true },
        });
        if (user?.onboarded) {
          let airports: string[] = [];
          try { airports = JSON.parse(user.homeAirports as unknown as string || "[]"); } catch {
            if (Array.isArray(user.homeAirports)) airports = user.homeAirports;
          }
          if (airports.length > 0) {
            origin = airports[0].toUpperCase();
          }
        }
      }
    } catch {
      // Auth failure shouldn't block — fall through to default
    }
  }

  if (!origin) {
    origin = "MCO"; // Default fallback
  }
  const limitStr = req.nextUrl.searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 50;
  const effectiveLimit = Math.min(isNaN(limit) ? 50 : limit, 200);

  try {
    const now = new Date();

    const cached = await prisma.awardCache.findMany({
      where: {
        origin,
        expiresAt: { gt: now },
      },
      orderBy: { score: "desc" },
      take: effectiveLimit,
    });

    // Transform DB rows to the AwardDeal-like shape the frontend expects
    const deals = cached.map((row) => ({
      id: `${row.origin}-${row.destination}-${row.cabin}`,
      flyFrom: row.origin,
      flyTo: row.destination,
      cityTo: row.destCity ?? row.destination,
      countryTo: row.destCountry ?? "",
      lat: row.destLat ?? 0,
      lon: row.destLon ?? 0,
      cabin: row.cabin,
      cabinLabel: row.cabinLabel ?? row.cabin,
      miles: row.miles,
      taxesUsd: row.taxesUsd,
      program: row.program,
      programName: row.programName ?? row.program,
      airlines: row.airlines ?? "",
      date: row.date ?? "",
      seatsLeft: row.remainingSeats,
      score: row.score ?? 0,
      homeAnchored: row.homeAnchored,
      tripType: row.tripType ?? "one-way",
      returnDate: row.returnDate,
      nights: row.nights,
      intl: row.isIntl,
      fetchedAt: row.fetchedAt.toISOString(),
    }));

    return NextResponse.json({
      origin,
      count: deals.length,
      deals,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
