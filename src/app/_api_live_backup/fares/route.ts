import { NextRequest, NextResponse } from "next/server";
import { getCachedFares } from "@/lib/services/fares";


/**
 * GET /api/fares?origin=MCO&month=6
 * Returns cached fares for an origin + month.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin");
  const monthStr = req.nextUrl.searchParams.get("month");

  if (!origin) {
    return NextResponse.json({ error: "origin is required" }, { status: 400 });
  }

  const month = monthStr != null ? parseInt(monthStr, 10) : new Date().getMonth();
  if (isNaN(month) || month < 0 || month > 11) {
    return NextResponse.json({ error: "month must be 0-11" }, { status: 400 });
  }

  try {
    const result = await getCachedFares(origin.toUpperCase(), month);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
