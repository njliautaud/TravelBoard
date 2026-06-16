import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { locationInclude, serializeLocation } from "@/lib/serialize";


type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (typeof body?.starred !== "boolean") {
    return NextResponse.json({ error: "Body must include starred (boolean)" }, { status: 400 });
  }
  const existing = await prisma.location.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.location.update({
    where: { id },
    data: { starred: body.starred },
    include: locationInclude,
  });
  return NextResponse.json({ location: serializeLocation(updated) });
}
