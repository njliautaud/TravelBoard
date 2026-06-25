import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_MS, verifyPassword } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/auth/login
 *
 * Auth: none (public).
 * Authenticates a user with username/password and sets a session cookie.
 * Rate limited: 5 attempts per 15 minutes per IP.
 *
 * Body: { username: string, password: string }
 * Response: { user: { id, username } }
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit check
    const ip = getClientIp(req.headers);
    const limit = checkRateLimit(`login:${ip}`);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later.", status: 429 },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const username = body?.username;
    const password = body?.password;
    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Username and password required", status: 400 }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid username or password", status: 401 }, { status: 401 });
    }

    const res = NextResponse.json({ user: { id: user.id, username: user.username } });
    res.cookies.set(SESSION_COOKIE, createSessionToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_TTL_MS / 1000,
      path: "/",
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
