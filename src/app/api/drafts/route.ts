import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/unified-auth";
import { serializeDraft } from "@/lib/serialize";


/**
 * GET /api/drafts
 *
 * Auth: optional (returns empty array for unauthenticated).
 * Lists the current user's draft inbox items.
 *
 * Response: { drafts: DraftItem[] }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ drafts: [] });
    const drafts = await prisma.draft.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ drafts: drafts.map(serializeDraft) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
