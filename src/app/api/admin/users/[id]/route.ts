import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/admin/users/[id]
 * Delete a user and all their data. Requires OWNER role.
 */
export async function DELETE(
  _req: NextRequest,
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

  // Prevent deleting yourself
  if (id === sessionUser.id) {
    return NextResponse.json(
      { error: "Cannot delete your own account from admin panel" },
      { status: 400 },
    );
  }

  try {
    // Check user exists
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Cascade delete handles all related records
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ deleted: true, username: target.username });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
