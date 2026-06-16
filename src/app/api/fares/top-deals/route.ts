import { NextRequest, NextResponse } from "next/server";
import { findTopDeals } from "@/lib/services/fares";
import {
  SeatsAeroBulkAdapter,
  generateAwardDeals,
  findAirport,
  VACATION_CODES,
  type AwardDeal,
} from "@travelboard/core";


/**
 * GET /api/fares/top-deals?origin=MCO&limit=25
 * Returns the top deals ranked by deal score, intermixing cash and award deals.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin") ?? undefined;
  const limitStr = req.nextUrl.searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 25;
  const effectiveLimit = isNaN(limit) ? 25 : Math.min(limit, 100);

  try {
    // Fetch cash deals from DB cache
    const cashDeals = await findTopDeals(
      origin?.toUpperCase(),
      effectiveLimit,
    );

    // Fetch award deals from seats.aero (server-side only, graceful fallback)
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
      // Award-specific fields
      isAward?: boolean;
      miles?: number;
      program?: string;
      programName?: string;
      cabin?: string;
      cabinLabel?: string;
      tripType?: string;
    }> = [];

    const apiKey = process.env.SEATSAERO_API_KEY;
    if (apiKey && origin) {
      try {
        const adapter = new SeatsAeroBulkAdapter({ apiKey });
        const records = await adapter.fetch();
        const vacationSet = new Set(VACATION_CODES);

        const awards = generateAwardDeals(records, {
          resolveAirport: (code: string) => findAirport(code),
          vacationCodes: vacationSet,
          homeAirport: origin.toUpperCase(),
          limit: 20,
        });

        awardItems = awards.map((a: AwardDeal) => ({
          id: `award-${a.id}`,
          origin: a.flyFrom,
          destination: a.cityTo,
          flyToCode: a.flyTo,
          month: a.date ? new Date(a.date).getMonth() : new Date().getMonth(),
          price: a.miles, // Display miles as the "price" — UI will format based on isAward
          currency: "miles",
          airline: a.airlines || null,
          source: "seats.aero",
          dealScore: Math.min(a.score / 2, 1), // Normalize score to 0-1 range
          tier: a.score >= 1.5 ? "cheap" : a.score >= 1.2 ? "fair" : "splurge",
          lastSeen: a.fetchedAt,
          savingsPercent: Math.round(Math.max(0, (a.score - 1) * 100)),
          outboundDate: a.date,
          returnDate: a.returnDate,
          countryTo: a.countryTo,
          isAward: true,
          miles: a.miles,
          program: a.program,
          programName: a.programName,
          cabin: a.cabin,
          cabinLabel: a.cabinLabel,
          tripType: a.tripType,
        }));
      } catch {
        // Award fetch failed — serve cash deals only
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
