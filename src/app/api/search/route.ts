import { NextRequest, NextResponse } from "next/server";
import {
  searchLocal,
  searchFlights,
  parseSmartSearch,
  type SearchKind,
} from "@/lib/services/search";


/**
 * GET /api/search
 *
 * Auth: none (public).
 * Unified search endpoint supporting places (local corpus) and flights (fare cache).
 *
 * Query params:
 *   q           -- search query (required for places mode)
 *   limit       -- max results (default 25)
 *   kinds       -- comma-separated: airport,destination,fare
 *   origin      -- origin IATA for flight search
 *   destination -- destination IATA for flight search
 *   month       -- 0-11 for month filter
 *   maxPrice    -- budget cap
 *   mode        -- "places" (default) or "flights"
 *   page        -- pagination page (default 1)
 *
 * Response: { hits, count } (places) or { results, total, page } (flights)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const mode = url.searchParams.get("mode") ?? "places";
    const limitStr = url.searchParams.get("limit");
    const limit = limitStr ? parseInt(limitStr, 10) : 25;

    if (!q.trim() && mode === "places") {
      return NextResponse.json({ hits: [], count: 0 });
    }

    if (mode === "flights") {
      const origin = url.searchParams.get("origin") ?? undefined;
      const destination = url.searchParams.get("destination") ?? undefined;
      const monthStr = url.searchParams.get("month");
      const month = monthStr != null ? parseInt(monthStr, 10) : undefined;
      const maxPriceStr = url.searchParams.get("maxPrice");
      const maxPrice = maxPriceStr ? parseInt(maxPriceStr, 10) : undefined;
      const pageStr = url.searchParams.get("page");
      const page = pageStr ? parseInt(pageStr, 10) : 1;

      let parsedDest = destination;
      let parsedMonth = month;
      let parsedBudget = maxPrice;

      if (q.trim() && !destination) {
        const smart = parseSmartSearch(q);
        if (smart.dest) parsedDest = smart.dest;
        if (smart.month != null && parsedMonth == null) parsedMonth = smart.month;
        if (smart.budget != null && parsedBudget == null) parsedBudget = smart.budget;
      }

      const response = await searchFlights({
        origin,
        destination: parsedDest,
        month: parsedMonth,
        maxPrice: parsedBudget,
        limit,
        page,
      });

      return NextResponse.json(response);
    }

    const kindsStr = url.searchParams.get("kinds");
    const kinds = kindsStr
      ? (kindsStr.split(",").filter(Boolean) as SearchKind[])
      : undefined;

    const hits = searchLocal({ q, limit, kinds });
    return NextResponse.json({ hits, count: hits.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
