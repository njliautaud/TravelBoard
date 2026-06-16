import { NextRequest, NextResponse } from "next/server";
import { getRouteHistory } from "@/lib/services/fares";


/**
 * GET /api/fares/history/:origin/:destination?days=30
 * Returns price history for a specific route.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ origin: string; destination: string }> },
) {
  const { origin, destination } = await params;
  const daysStr = req.nextUrl.searchParams.get("days");
  const days = daysStr ? parseInt(daysStr, 10) : 30;

  if (!origin || !destination) {
    return NextResponse.json(
      { error: "origin and destination are required" },
      { status: 400 },
    );
  }

  try {
    const history = await getRouteHistory(
      origin.toUpperCase(),
      destination.toUpperCase(),
      isNaN(days) ? 30 : Math.min(days, 365),
    );
    return NextResponse.json({ origin, destination, history });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
