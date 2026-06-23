import { NextRequest, NextResponse } from "next/server";
import { findLounges, listAirportsWithLounges, type AccessMethod } from "@/lib/services/lounges";


/**
 * GET /api/lounges/search?airport=MCO&amenities=wifi,shower&access=priority_pass&maxPrice=50
 *
 * Auth: none (public reference data).
 * Searches for lounges at a given airport. If no airport is provided, returns
 * the list of airports that have lounges.
 *
 * Response: { airports: string[] } or { lounges: Lounge[], ... }
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const airport = url.searchParams.get("airport");

    if (!airport) {
      return NextResponse.json({ airports: listAirportsWithLounges() });
    }

    const amenities = url.searchParams.get("amenities")?.split(",").filter(Boolean);
    const accessMethods = url.searchParams.get("access")?.split(",").filter(Boolean) as AccessMethod[] | undefined;
    const maxPrice = url.searchParams.get("maxPrice") ? Number(url.searchParams.get("maxPrice")) : undefined;

    const result = findLounges(airport, { amenities, accessMethods, maxDayPassPrice: maxPrice });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
