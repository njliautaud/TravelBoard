import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  hashPassword,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  validatePassword,
  validateUsername,
} from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/auth/register
 *
 * Auth: none (public).
 * Creates a new user account and sets a session cookie.
 * Rate limited: 5 attempts per 15 minutes per IP.
 *
 * Body: { username: string, password: string }
 * Response: { user: { id, username } }
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit check
    const ip = getClientIp(req.headers);
    const limit = checkRateLimit(`register:${ip}`);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Try again later.", status: 429 },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const username = body?.username;
    const password = body?.password;
    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Username and password required", status: 400 }, { status: 400 });
    }
    const uErr = validateUsername(username);
    if (uErr) return NextResponse.json({ error: uErr, status: 400 }, { status: 400 });
    const pErr = validatePassword(password);
    if (pErr) return NextResponse.json({ error: pErr, status: 400 }, { status: 400 });

    const existing = await prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
    });
    if (existing) return NextResponse.json({ error: "Username already taken", status: 409 }, { status: 409 });

    const user = await prisma.user.create({
      data: {
        username: username.trim().toLowerCase(),
        passwordHash: await hashPassword(password),
      },
      select: { id: true, username: true },
    });

    const res = NextResponse.json({ user }, { status: 201 });
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
