import { NextResponse } from "next/server";
import { getBadgeCatalog } from "@/lib/services/gamification";


/**
 * GET /api/gamification/badges
 *
 * Auth: none (public reference data).
 * Returns the full badge catalog.
 *
 * Response: { badges: Badge[] }
 */
export async function GET() {
  try {
    const badges = getBadgeCatalog();
    return NextResponse.json({ badges });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
