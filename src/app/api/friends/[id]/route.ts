import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/friends/[id] — respond to an incoming request.
 * Body: { action: "accept" | "decline" }. Only the addressee may respond.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: 'action must be "accept" or "decline"' }, { status: 400 });
  }

  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship || friendship.addresseeId !== me.id || friendship.status !== "PENDING") {
    return NextResponse.json({ error: "No pending request found." }, { status: 404 });
  }

  // The matching FRIEND_REQUEST notification in your inbox is now resolved.
  await prisma.notification.updateMany({
    where: { userId: me.id, friendshipId: friendship.id, type: "FRIEND_REQUEST" },
    data: { read: true },
  });

  if (action === "decline") {
    await prisma.friendship.delete({ where: { id } });
    return NextResponse.json({ ok: true, status: "declined" });
  }

  await prisma.friendship.update({
    where: { id },
    data: { status: "ACCEPTED", respondedAt: new Date() },
  });
  // Let the requester know you accepted.
  await prisma.notification.create({
    data: {
      userId: friendship.requesterId,
      actorId: me.id,
      type: "FRIEND_ACCEPTED",
      friendshipId: friendship.id,
    },
  });

  return NextResponse.json({ ok: true, status: "accepted" });
}

/**
 * DELETE /api/friends/[id] — remove a friendship (or cancel a request you sent).
 * Either party may remove.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship || (friendship.requesterId !== me.id && friendship.addresseeId !== me.id)) {
    return NextResponse.json({ error: "Friendship not found." }, { status: 404 });
  }

  await prisma.friendship.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
