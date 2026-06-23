import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/users — list every account so a logged-in user can switch between
 * friends' boards (read-only). This is a small, private instance: everyone who
 * is logged in may view everyone else's wishes. Edits stay owner-only (the
 * mutating routes scope by the session user), so viewing is read-only by design.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ users: [] }, { status: 401 });

  const users = await prisma.user.findMany({
    select: { id: true, username: true },
    orderBy: { username: "asc" },
  });
  return NextResponse.json({ users });
}
