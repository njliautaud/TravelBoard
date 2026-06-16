import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_MS, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = body?.username;
  const password = body?.password;
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
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
}
