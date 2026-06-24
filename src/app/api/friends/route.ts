import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import type { FriendsData } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/friends — your accepted friends plus pending requests in both
 * directions (incoming = waiting on you, outgoing = waiting on them).
 */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: me.id }, { addresseeId: me.id }] },
    include: {
      requester: { select: { id: true, username: true } },
      addressee: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const data: FriendsData = { friends: [], incoming: [], outgoing: [] };
  for (const r of rows) {
    const other = r.requesterId === me.id ? r.addressee : r.requester;
    if (r.status === "ACCEPTED") {
      data.friends.push({
        friendshipId: r.id,
        user: other,
        since: (r.respondedAt ?? r.createdAt).toISOString(),
      });
    } else if (r.addresseeId === me.id) {
      data.incoming.push({ friendshipId: r.id, user: other, createdAt: r.createdAt.toISOString() });
    } else {
      data.outgoing.push({ friendshipId: r.id, user: other, createdAt: r.createdAt.toISOString() });
    }
  }

  // Active friends first, alphabetical.
  data.friends.sort((a, b) => a.user.username.localeCompare(b.user.username));
  return NextResponse.json(data);
}

/**
 * POST /api/friends — send a friend request by username.
 * Body: { username: string }
 * Robust errors: empty username, adding yourself, unknown username, already
 * friends, request already sent. If they already requested you, it auto-accepts.
 */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const raw = typeof body?.username === "string" ? body.username.trim() : "";
  if (!raw) return NextResponse.json({ error: "Enter a username to add." }, { status: 400 });

  const username = raw.replace(/^@/, "").toLowerCase();
  if (username === me.username.toLowerCase()) {
    return NextResponse.json({ error: "You can't add yourself as a friend." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  if (!target) {
    return NextResponse.json({ error: `No user named "${raw}".` }, { status: 404 });
  }

  // Any existing link in either direction?
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: me.id, addresseeId: target.id },
        { requesterId: target.id, addresseeId: me.id },
      ],
    },
  });

  if (existing?.status === "ACCEPTED") {
    return NextResponse.json({ error: `You're already friends with ${target.username}.` }, { status: 409 });
  }
  if (existing && existing.requesterId === me.id) {
    return NextResponse.json({ error: `You already have a pending request to ${target.username}.` }, { status: 409 });
  }
  if (existing && existing.addresseeId === me.id) {
    // They already asked you — accept it instead of creating a duplicate.
    const accepted = await prisma.friendship.update({
      where: { id: existing.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });
    await prisma.notification.create({
      data: { userId: target.id, actorId: me.id, type: "FRIEND_ACCEPTED", friendshipId: accepted.id },
    });
    await prisma.notification.updateMany({
      where: { userId: me.id, friendshipId: accepted.id, type: "FRIEND_REQUEST" },
      data: { read: true },
    });
    return NextResponse.json({ ok: true, status: "accepted", friend: target }, { status: 200 });
  }

  const friendship = await prisma.friendship.create({
    data: { requesterId: me.id, addresseeId: target.id, status: "PENDING" },
  });
  await prisma.notification.create({
    data: { userId: target.id, actorId: me.id, type: "FRIEND_REQUEST", friendshipId: friendship.id },
  });

  return NextResponse.json({ ok: true, status: "requested", friend: target }, { status: 201 });
}
