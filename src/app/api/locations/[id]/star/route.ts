import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/unified-auth";
import { locationInclude, serializeLocation } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/locations/:id/star
 *
 * Auth: required (must own the location).
 * Toggles the starred status of a location.
 *
 * Body: { starred: boolean }
 * Response: { location: Location }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (typeof body?.starred !== "boolean") {
      return NextResponse.json({ error: "Body must include starred (boolean)", status: 400 }, { status: 400 });
    }
    const existing = await prisma.location.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });

    const updated = await prisma.location.update({
      where: { id },
      data: { starred: body.starred },
      include: locationInclude,
    });
    return NextResponse.json({ location: serializeLocation(updated) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
