import { NextRequest, NextResponse } from "next/server";
import { findTopDeals } from "@/lib/services/fares";

export const dynamic = "force-dynamic";

/**
 * GET /api/fares/top-deals?origin=MCO&limit=25
 * Returns the top deals ranked by deal score.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin") ?? undefined;
  const limitStr = req.nextUrl.searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 25;

  try {
    const deals = await findTopDeals(
      origin?.toUpperCase(),
      isNaN(limit) ? 25 : Math.min(limit, 100),
    );
    return NextResponse.json({ deals });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
