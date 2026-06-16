import { NextRequest, NextResponse } from "next/server";
import { routeCalendar, routePriceHistory } from "@/lib/services/search";


/**
 * GET /api/search/calendar — calendar view of fares for a route.
 *
 * Query params:
 *   origin      — origin IATA (required)
 *   destination — destination IATA (required)
 *   view        — "calendar" (departure dates) or "history" (price over time)
 *   days        — history lookback days (default 90, only for view=history)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.searchParams.get("origin");
  const destination = url.searchParams.get("destination");
  const view = url.searchParams.get("view") ?? "calendar";

  if (!origin || !destination) {
    return NextResponse.json(
      { error: "origin and destination query params required" },
      { status: 400 },
    );
  }

  if (view === "history") {
    const daysStr = url.searchParams.get("days");
    const days = daysStr ? parseInt(daysStr, 10) : 90;
    const points = await routePriceHistory(origin, destination, days);
    return NextResponse.json({ origin, destination, view: "history", points });
  }

  const points = await routeCalendar(origin, destination);
  return NextResponse.json({ origin, destination, view: "calendar", points });
}
