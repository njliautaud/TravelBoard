import { NextRequest, NextResponse } from "next/server";
import { getGuide } from "@/lib/services/destination-guides";


/**
 * GET /api/destinations/[code]
 *
 * Auth: none (public reference data).
 * Returns destination guide data for an airport/destination code.
 *
 * Response: DestinationGuide object or { error: string }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const guide = getGuide(code);

    if (!guide) {
      return NextResponse.json(
        { error: `No guide for ${code}`, status: 404 },
        { status: 404 },
      );
    }

    return NextResponse.json(guide);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
