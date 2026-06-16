import { NextRequest, NextResponse } from "next/server";
import { trackFlightSummary } from "@/lib/services/flight-tracker";


/**
 * GET /api/track/[flight] — live flight position lookup.
 *
 * Example: GET /api/track/UA123
 * Returns lat, lon, altitude, speed, origin, destination, progress, ETA.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ flight: string }> },
) {
  const { flight } = await params;

  if (!flight || flight.length < 2) {
    return NextResponse.json(
      { error: "Invalid flight number" },
      { status: 400 },
    );
  }

  try {
    const summary = await trackFlightSummary(flight);
    return NextResponse.json(summary);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to track flight";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
