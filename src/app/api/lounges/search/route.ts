import { NextRequest, NextResponse } from "next/server";
import { findLounges, listAirportsWithLounges, type AccessMethod } from "@/lib/services/lounges";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const airport = url.searchParams.get("airport");

  if (!airport) {
    // Return list of airports with lounges
    return NextResponse.json({ airports: listAirportsWithLounges() });
  }

  const amenities = url.searchParams.get("amenities")?.split(",").filter(Boolean);
  const accessMethods = url.searchParams.get("access")?.split(",").filter(Boolean) as AccessMethod[] | undefined;
  const maxPrice = url.searchParams.get("maxPrice") ? Number(url.searchParams.get("maxPrice")) : undefined;

  const result = findLounges(airport, { amenities, accessMethods, maxDayPassPrice: maxPrice });
  return NextResponse.json(result);
}
