import { NextRequest, NextResponse } from "next/server";
import { findTopDeals } from "@/lib/services/fares";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/fares/top-deals?origin=MCO&limit=25
 * Returns the top deals ranked by deal score, intermixing cash and award deals.
 *
 * Award deals now come from AwardCache (DB) instead of live seats.aero calls.
 * Cash deals come from FareCache (with 7-day staleness filter).
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin") ?? undefined;
  const limitStr = req.nextUrl.searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 25;
  const effectiveLimit = isNaN(limit) ? 25 : Math.min(limit, 100);

  try {
    // Fetch cash deals from DB cache (staleness-filtered via findTopDeals)
    const cashDeals = await findTopDeals(
      origin?.toUpperCase(),
      effectiveLimit,
    );

    // Fetch award deals from AwardCache (DB) instead of live API
    let awardItems: Array<{
      id: string;
      origin: string;
      destination: string;
      flyToCode: string;
      month: number;
      price: number;
      currency: string;
      airline: string | null;
      source: string | null;
      dealScore: number | null;
      tier: string | null;
      lastSeen: string;
      savingsPercent: number;
      outboundDate: string | null;
      returnDate: string | null;
      countryTo?: string;
      isAward?: boolean;
      miles?: number;
      program?: string;
      programName?: string;
      cabin?: string;
      cabinLabel?: string;
      tripType?: string;
    }> = [];

    if (origin) {
      try {
        const now = new Date();
        const cached = await prisma.awardCache.findMany({
          where: {
            origin: origin.toUpperCase(),
            expiresAt: { gt: now },
          },
          orderBy: { score: "desc" },
          take: 20,
        });

        awardItems = cached.map((row) => ({
          id: `award-${row.origin}-${row.destination}-${row.cabin}`,
          origin: row.origin,
          destination: row.destCity ?? row.destination,
          flyToCode: row.destination,
          month: row.date ? new Date(row.date).getMonth() : new Date().getMonth(),
          price: row.miles,
          currency: "miles",
          airline: row.airlines ?? null,
          source: "seats.aero",
          dealScore: row.score != null ? Math.min(row.score / 2, 1) : null,
          tier: (row.score ?? 0) >= 1.5 ? "cheap" : (row.score ?? 0) >= 1.2 ? "fair" : "splurge",
          lastSeen: row.fetchedAt.toISOString(),
          savingsPercent: Math.round(Math.max(0, ((row.score ?? 1) - 1) * 100)),
          outboundDate: row.date ?? null,
          returnDate: row.returnDate ?? null,
          countryTo: row.destCountry ?? undefined,
          isAward: true,
          miles: row.miles,
          program: row.program,
          programName: row.programName ?? row.program,
          cabin: row.cabin,
          cabinLabel: row.cabinLabel ?? row.cabin,
          tripType: row.tripType ?? "one-way",
        }));
      } catch {
        // Award cache read failed — serve cash deals only
      }
    }

    // Intermix: sort by dealScore descending, awards and cash together
    const allDeals = [...cashDeals, ...awardItems]
      .sort((a, b) => (b.dealScore ?? 0) - (a.dealScore ?? 0))
      .slice(0, effectiveLimit);

    return NextResponse.json({ deals: allDeals });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
