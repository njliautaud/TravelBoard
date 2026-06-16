import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { acknowledgeAlert } from "@/lib/services/watches";


/** POST /api/alerts/[id]/ack — acknowledge (mark as read) a single alert */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ok = await acknowledgeAlert(id, user.id);
  if (!ok) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
