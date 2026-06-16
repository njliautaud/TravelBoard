import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { recordEvent, type GamificationEvent } from "@/lib/services/gamification";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["search", "deal_found", "share", "trip_added", "alert_triggered", "journal_entry", "board_created"];

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !VALID_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  const result = await recordEvent(user.id, body as GamificationEvent);
  return NextResponse.json({ result });
}
