import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { acknowledgeAlert } from "@/lib/services/watches";


/**
 * POST /api/alerts/[id]/ack
 *
 * Auth: required.
 * Acknowledge (mark as read) a single alert.
 *
 * Response: { ok: true }
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    }

    const { id } = await params;
    const ok = await acknowledgeAlert(id, user.id);
    if (!ok) {
      return NextResponse.json({ error: "Alert not found", status: 404 }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
