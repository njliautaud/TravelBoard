import { NextRequest, NextResponse } from "next/server";
import { routeCalendar, routePriceHistory } from "@/lib/services/search";


/**
 * GET /api/search/calendar
 *
 * Auth: none (public).
 * Calendar view of fares for a route, or price history over time.
 *
 * Query params:
 *   origin      -- origin IATA (required)
 *   destination -- destination IATA (required)
 *   view        -- "calendar" (departure dates) or "history" (price over time)
 *   days        -- history lookback days (default 90, only for view=history)
 *
 * Response: { origin, destination, view, points }
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const origin = url.searchParams.get("origin");
    const destination = url.searchParams.get("destination");
    const view = url.searchParams.get("view") ?? "calendar";

    if (!origin || !destination) {
      return NextResponse.json(
        { error: "origin and destination query params required", status: 400 },
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
