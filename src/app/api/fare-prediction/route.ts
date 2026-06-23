import { NextRequest, NextResponse } from "next/server";
import { predictFare } from "@/lib/services/fare-prediction";

/**
 * POST /api/fare-prediction
 *
 * Auth: none (public).
 * Returns a price prediction for a route based on historical fare data.
 *
 * Body: { origin: string, destination: string }
 * Response: prediction object from fare-prediction service
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.origin || !body?.destination) {
      return NextResponse.json({ error: "origin and destination are required", status: 400 }, { status: 400 });
    }

    const prediction = await predictFare(body.origin, body.destination);
    return NextResponse.json(prediction);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
