import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { optimizeTransfer } from "@/lib/services/points";

/**
 * POST /api/points/optimize
 *
 * Auth: required.
 * Optimizes transfer partner selection based on user's card profiles and destination.
 *
 * Body: { destination: string, cashPrice?: number, cabin?: string }
 * Response: optimization result with best transfer options
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body?.destination) {
      return NextResponse.json({ error: "destination is required", status: 400 }, { status: 400 });
    }

    const result = await optimizeTransfer(
      user.id,
      body.destination,
      body.cashPrice ?? null,
      body.cabin ?? "economy",
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
