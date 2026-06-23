import { NextRequest, NextResponse } from "next/server";
import { getSweetSpots } from "@/lib/services/points";


/**
 * GET /api/points/sweet-spots?region=asia&cabin=business
 *
 * Auth: none (public reference data).
 * Returns points sweet spots, optionally filtered by region and cabin class.
 *
 * Response: { sweetSpots: SweetSpot[] }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region") ?? undefined;
    const cabin = searchParams.get("cabin") ?? undefined;

    const spots = getSweetSpots(region, cabin);
    return NextResponse.json({ sweetSpots: spots });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
