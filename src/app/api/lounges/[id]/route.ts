import { NextRequest, NextResponse } from "next/server";
import { getLoungeById } from "@/lib/services/lounges";


type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/lounges/[id]
 *
 * Auth: none (public reference data).
 * Returns details for a specific lounge.
 *
 * Response: { lounge: Lounge }
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const lounge = getLoungeById(id);
    if (!lounge) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    return NextResponse.json({ lounge });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
