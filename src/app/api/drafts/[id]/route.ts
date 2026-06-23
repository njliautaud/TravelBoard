import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/unified-auth";


type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/drafts/[id]
 *
 * Auth: required.
 * Deletes a draft owned by the current user.
 *
 * Response: { ok: true }
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    const { id } = await params;
    const draft = await prisma.draft.findFirst({ where: { id, userId: user.id } });
    if (!draft) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    await prisma.draft.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
