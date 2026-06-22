import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/locations/reorder
 * Body: { ids: string[] } — the location ids in their new top-to-bottom order
 * (typically the wishes within one country). Writes sortOrder = array index.
 * Only the caller's own locations are touched.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "ids must be an array of strings" }, { status: 400 });
  }

  await prisma.$transaction(
    (ids as string[]).map((id, index) =>
      prisma.location.updateMany({
        where: { id, userId: user.id },
        data: { sortOrder: index },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
