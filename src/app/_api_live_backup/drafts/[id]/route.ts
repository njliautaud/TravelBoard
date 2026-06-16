import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";


type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const draft = await prisma.draft.findFirst({ where: { id, userId: user.id } });
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.draft.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
