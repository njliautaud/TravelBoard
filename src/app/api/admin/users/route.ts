import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/users
 * List all users with stats. Requires OWNER role.
 */
export async function GET() {
  const sessionUser = await getAuthUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true },
  });

  if (dbUser?.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        imageUrl: true,
        createdAt: true,
        onboarded: true,
        _count: {
          select: {
            locations: true,
            journalEntries: true,
            trips: true,
            watches: true,
            createdBoards: true,
            boardDeals: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
