import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * POST /api/auth/logout
 *
 * Auth: none.
 * Clears the session cookie to log out the user.
 *
 * Response: { ok: true }
 */
export async function POST() {
  try {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
