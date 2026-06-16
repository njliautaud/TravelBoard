import { NextRequest, NextResponse } from "next/server";
import {
  SeatsAeroBulkAdapter,
  generateAwardDeals,
  findAirport,
  VACATION_CODES,
} from "@travelboard/core";

/**
 * GET /api/awards/availability?origin=MCO&limit=50
 *
 * Returns award deals from seats.aero bulk availability, anchored to the
 * user's home airport. The API key is server-side only (never exposed to client).
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.SEATSAERO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Award availability not configured" },
      { status: 503 },
    );
  }

  const origin = req.nextUrl.searchParams.get("origin")?.toUpperCase() ?? "MCO";
  const limitStr = req.nextUrl.searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 50;

  try {
    const adapter = new SeatsAeroBulkAdapter({ apiKey });
    const records = await adapter.fetch();

    const vacationSet = new Set(VACATION_CODES);

    const deals = generateAwardDeals(records, {
      resolveAirport: (code: string) => findAirport(code),
      vacationCodes: vacationSet,
      homeAirport: origin,
      limit: Math.min(limit, 200),
    });

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
