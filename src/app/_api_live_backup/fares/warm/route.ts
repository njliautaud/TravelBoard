import { NextRequest, NextResponse } from "next/server";
import { warmCache } from "@/lib/services/fares";
import { getFlightProvider } from "@/lib/providers";
import { getSessionUser } from "@/lib/auth";


/**
 * POST /api/fares/warm
 * Body: { origin: string, month: number }
 * Protected: requires authenticated session.
 * Triggers a cache warming for the given origin + month.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { origin?: string; month?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { origin, month } = body;
  if (!origin || typeof origin !== "string") {
    return NextResponse.json({ error: "origin is required" }, { status: 400 });
  }
  if (month == null || typeof month !== "number" || month < 0 || month > 11) {
    return NextResponse.json(
      { error: "month must be a number 0-11" },
      { status: 400 },
    );
  }

  try {
    const provider = getFlightProvider();
    const count = await warmCache(provider, origin.toUpperCase(), month);
    return NextResponse.json({ success: true, origin, month, count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
