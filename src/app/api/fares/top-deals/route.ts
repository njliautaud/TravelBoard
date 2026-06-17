import { NextRequest, NextResponse } from "next/server";
import { findTopDeals } from "@/lib/services/fares";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// Map onboarding loyalty program IDs -> seats.aero program keys (where they differ)
const PROGRAM_ID_TO_SEATS_KEY: Record<string, string> = {
  flying_blue: "flyingblue",
  virgin_atlantic: "virginatlantic",
  avianca: "lifemiles",
  ba_avios: "avios", // BA Avios may appear as "avios" in seats.aero
};

/** Convert user-facing loyalty program IDs to AwardCache program keys */
function mapToAwardPrograms(userPrograms: string[]): string[] {
  // Only airline programs are relevant for award searches (not credit cards / hotels)
  const airlineIds = new Set([
    "aeroplan", "delta", "united", "american", "southwest", "jetblue",
    "alaska", "flying_blue", "ba_avios", "virgin_atlantic", "singapore",
    "emirates", "cathay", "ana", "turkish", "qantas", "avianca", "hawaiian",
  ]);
  return userPrograms
    .filter((id) => airlineIds.has(id))
    .map((id) => PROGRAM_ID_TO_SEATS_KEY[id] ?? id);
}

// US airport codes (major hubs) for domestic detection heuristic
const US_PREFIXES = new Set([
  "ATL", "DFW", "DEN", "ORD", "LAX", "CLT", "MCO", "LAS", "PHX", "MIA",
  "SEA", "JFK", "EWR", "SFO", "IAH", "BOS", "FLL", "MSP", "DTW", "PHL",
  "LGA", "BWI", "SLC", "SAN", "DCA", "IAD", "TPA", "HNL", "PDX", "STL",
  "BNA", "AUS", "RDU", "OAK", "MCI", "SMF", "SJC", "CLE", "IND", "CMH",
  "PIT", "SAT", "CVG", "MKE", "OGG", "ABQ", "ANC", "ONT", "BUR", "RNO",
]);

/**
 * GET /api/fares/top-deals?origin=MCO&limit=25
 * Returns the top deals ranked by deal score, intermixing cash and award deals.
 *
 * When the user is authenticated and has onboarding preferences:
 * - If no origin param, uses all of the user's home airports
 * - Filters by flight preference (international/domestic/both)
 * - Prioritizes award deals from the user's loyalty programs
 */
export async function GET(req: NextRequest) {
  const originParam = req.nextUrl.searchParams.get("origin") ?? undefined;
  const limitStr = req.nextUrl.searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 25;
  const effectiveLimit = isNaN(limit) ? 25 : Math.min(limit, 100);

  // Load user preferences if authenticated
  let userAirports: string[] = [];
  let flightPref: string = "both";
  let loyaltyPrograms: string[] = [];

  try {
    const session = await getSessionUser();
    if (session) {
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: {
          homeAirports: true,
          flightPref: true,
          loyaltyPrograms: true,
          onboarded: true,
        },
      });
      if (user?.onboarded) {
        try { userAirports = JSON.parse(user.homeAirports || "[]"); } catch {}
        flightPref = user.flightPref || "both";
        try { loyaltyPrograms = JSON.parse(user.loyaltyPrograms || "[]"); } catch {}
      }
    }
  } catch {
    // Auth failures shouldn't block deals — serve unfiltered
  }

  // Determine which origins to query
  // Explicit param takes priority; otherwise use user's home airports
  const origins: string[] = originParam
    ? [originParam.toUpperCase()]
    : userAirports.length > 0
      ? userAirports
      : []; // empty = all origins (no filter)

  try {
    // Fetch cash deals — query each origin and merge
    let cashDeals: Awaited<ReturnType<typeof findTopDeals>> = [];
    if (origins.length === 0) {
      cashDeals = await findTopDeals(undefined, effectiveLimit);
    } else if (origins.length === 1) {
      cashDeals = await findTopDeals(origins[0], effectiveLimit);
    } else {
      // Multiple home airports: fetch for each, then merge
      const perOrigin = await Promise.all(
        origins.map((o) => findTopDeals(o, effectiveLimit))
      );
      cashDeals = perOrigin.flat();
    }

    // Apply flight preference filter to cash deals
    if (flightPref === "domestic") {
      cashDeals = cashDeals.filter((d) => US_PREFIXES.has(d.flyToCode));
    } else if (flightPref === "international") {
      cashDeals = cashDeals.filter((d) => !US_PREFIXES.has(d.flyToCode));
    }

    // Fetch award deals from AwardCache
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

    const awardOrigins = origins.length > 0 ? origins : undefined;

    if (awardOrigins === undefined || awardOrigins.length > 0) {
      try {
        const now = new Date();
        const whereClause: Record<string, unknown> = {
          expiresAt: { gt: now },
        };

        if (awardOrigins && awardOrigins.length === 1) {
          whereClause.origin = awardOrigins[0];
        } else if (awardOrigins && awardOrigins.length > 1) {
          whereClause.origin = { in: awardOrigins };
        }

        // Filter by flight preference
        if (flightPref === "international") {
          whereClause.isIntl = true;
        } else if (flightPref === "domestic") {
          whereClause.isIntl = false;
        }

        // Filter by user's loyalty programs if they have any
        const awardPrograms = mapToAwardPrograms(loyaltyPrograms);
        if (awardPrograms.length > 0) {
          whereClause.program = { in: awardPrograms };
        }

        const cached = await prisma.awardCache.findMany({
          where: whereClause,
          orderBy: { score: "desc" },
          take: 40,
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

    // Assign basic deal scores to unscored cash deals based on price ranking
    if (cashDeals.length > 0) {
      const prices = cashDeals.map((d) => d.price).sort((a, b) => a - b);
      const maxPrice = prices[prices.length - 1] ?? 1;
      const minPrice = prices[0] ?? 0;
      const range = maxPrice - minPrice || 1;
      for (const deal of cashDeals) {
        if (deal.dealScore == null) {
          deal.dealScore = 0.3 + 0.5 * (1 - (deal.price - minPrice) / range);
        }
      }
    }

    // Boost award deals that match user's loyalty programs
    const mappedPrograms = mapToAwardPrograms(loyaltyPrograms);
    if (mappedPrograms.length > 0) {
      for (const deal of awardItems) {
        if (deal.program && mappedPrograms.includes(deal.program)) {
          deal.dealScore = Math.min(1, (deal.dealScore ?? 0) + 0.15);
        }
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
