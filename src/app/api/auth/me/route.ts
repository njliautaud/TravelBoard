import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";

/**
 * GET /api/auth/me
 *
 * Auth: optional.
 * Returns the current authenticated user, or null if not logged in.
 *
 * Response: { user: { id, username, imageUrl } | null, loggedIn: boolean, editor: boolean }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    return NextResponse.json({
      user: user ? { id: user.id, username: user.username, imageUrl: user.imageUrl, role: user.role } : null,
      loggedIn: user !== null,
      editor: user !== null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
