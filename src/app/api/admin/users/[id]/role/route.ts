import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/admin/users/[id]/role
 * Update a user's role. Requires OWNER role.
 * Body: { role: "OWNER" | "EDITOR" | "VIEWER" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;

  // Prevent demoting yourself
  if (id === sessionUser.id) {
    return NextResponse.json(
      { error: "Cannot change your own role" },
      { status: 400 },
    );
  }

  try {
    const body = await req.json();
    const { role } = body;

    if (!["OWNER", "EDITOR", "VIEWER"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be OWNER, EDITOR, or VIEWER" },
        { status: 400 },
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, username: true, role: true },
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
