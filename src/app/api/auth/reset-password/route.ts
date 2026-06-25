import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePassword } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/auth/reset-password
 *
 * Auth: none (public, token-based).
 * Resets user password using a valid reset token.
 *
 * Body: { token: string, password: string }
 * Response: { message: string }
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 attempts per 15 min per IP
    const ip = getClientIp(req.headers);
    const limit = checkRateLimit(`reset-password:${ip}`);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later.", status: 429 },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const token = body?.token;
    const password = body?.password;

    if (typeof token !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Token and new password are required", status: 400 },
        { status: 400 }
      );
    }

    const pErr = validatePassword(password);
    if (pErr) {
      return NextResponse.json({ error: pErr, status: 400 }, { status: 400 });
    }

    // Find valid, unused, non-expired token
    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        token,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetRecord) {
      return NextResponse.json(
        { error: "Invalid or expired reset token", status: 400 },
        { status: 400 }
      );
    }

    // Update password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ message: "Password has been reset successfully." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
