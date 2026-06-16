import { NextRequest, NextResponse } from "next/server";
import { getGuide } from "@/lib/services/destination-guides";


/**
 * GET /api/destinations/[code] — return destination guide data.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const guide = getGuide(code);

  if (!guide) {
    return NextResponse.json(
      { error: `No guide for ${code}` },
      { status: 404 },
    );
  }

  return NextResponse.json(guide);
}
