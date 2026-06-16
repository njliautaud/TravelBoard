import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { serializeDraft } from "@/lib/serialize";


export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ drafts: [] });
  const drafts = await prisma.draft.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ drafts: drafts.map(serializeDraft) });
}
