import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import type { NotificationItem } from "@/lib/types";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/** GET /api/notifications — your inbox notifications, newest first. */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ notifications: [] }, { status: 401 });

  const rows = await prisma.notification.findMany({
    where: { userId: me.id },
    include: { actor: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const notifications: NotificationItem[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    actor: n.actor,
    friendshipId: n.friendshipId,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));

  return NextResponse.json({ notifications });
}

/**
 * PATCH /api/notifications — mark notifications read.
 * Optional body { type: "FRIEND_ACCEPTED" } to mark only that type (so unresolved
 * friend requests stay actionable in the inbox). No body = mark everything read.
 */
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const where: Prisma.NotificationWhereInput = { userId: me.id, read: false };
  if (body?.type === "FRIEND_ACCEPTED" || body?.type === "FRIEND_REQUEST") {
    where.type = body.type;
  }

  await prisma.notification.updateMany({ where, data: { read: true } });
  return NextResponse.json({ ok: true });
}
