import { NextRequest, NextResponse } from "next/server";
import { calculatePoints } from "@/lib/services/points";

/**
 * POST /api/points/calculator
 *
 * Auth: none (public).
 * Calculates points value and redemption options for a destination.
 *
 * Body: { destination: string, cashPrice?: number, cabin?: string }
 * Response: calculation result with cpp, programs, etc.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.destination) {
      return NextResponse.json({ error: "destination is required", status: 400 }, { status: 400 });
    }

    const result = calculatePoints(
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
