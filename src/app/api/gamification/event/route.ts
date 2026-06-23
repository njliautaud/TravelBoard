import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { recordEvent, type GamificationEvent } from "@/lib/services/gamification";

const VALID_TYPES = ["search", "deal_found", "share", "trip_added", "alert_triggered", "journal_entry", "board_created"];

/**
 * POST /api/gamification/event
 *
 * Auth: required.
 * Records a gamification event (e.g., search, deal found, share) for the current user.
 *
 * Body: { type: string, ... }
 * Response: { result }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || !VALID_TYPES.includes(body.type)) {
      return NextResponse.json({ error: "Invalid event type", status: 400 }, { status: 400 });
    }

    const result = await recordEvent(user.id, body as GamificationEvent);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
