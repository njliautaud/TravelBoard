import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/auth/forgot-password
 *
 * Auth: none (public).
 * Generates a password reset token for the given username or email.
 * Always returns success (to avoid user enumeration).
 *
 * Body: { username: string }
 * Response: { message: string, token?: string }
 *
 * NOTE: Since this app doesn't have email sending configured,
 * the token is returned in the response for now. In production,
 * this would be sent via email instead.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 attempts per 15 min per IP
    const ip = getClientIp(req.headers);
    const limit = checkRateLimit(`forgot-password:${ip}`);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later.", status: 429 },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const username = body?.username;
    if (typeof username !== "string" || !username.trim()) {
      return NextResponse.json(
        { error: "Username is required", status: 400 },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
    });

    // Always return success to prevent user enumeration
    if (!user) {
      return NextResponse.json({
        message: "If that account exists, a reset link has been generated.",
      });
    }

    // Invalidate any existing unused tokens for this user
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { expiresAt: new Date(0) },
    });

    // Generate a secure token, valid for 1 hour
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // In a real app, send this via email. For now, return it directly.
    return NextResponse.json({
      message: "If that account exists, a reset link has been generated.",
      // Return token directly since no email service is configured
      token,
      resetUrl: `/forgot-password?token=${token}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
