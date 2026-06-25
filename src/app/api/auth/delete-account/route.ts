import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/delete-account
 *
 * Auth: required.
 * Permanently deletes the authenticated user and all their data.
 * Prisma's onDelete: Cascade handles cleaning up related records.
 *
 * Response: { message: string }
 */
export async function POST() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", status: 401 },
        { status: 401 }
      );
    }

    // Delete user — cascading deletes handle all related data
    await prisma.user.delete({
      where: { id: user.id },
    });

    // Sign out of Supabase (clears Supabase session cookies)
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // Best-effort; user row is already deleted.
    }

    return NextResponse.json({ message: "Account deleted successfully." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
