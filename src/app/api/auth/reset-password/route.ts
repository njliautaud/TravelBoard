import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/auth/reset-password
 *
 * Auth: requires an active Supabase recovery session (the user arrived via the
 * password-reset email link → /auth/callback → /reset-password, which exchanged
 * the recovery code for a session cookie).
 *
 * Body: { password: string }
 * Response: { message: string }
 *
 * Note: the legacy token-based flow (PasswordReset table + bcrypt) was replaced
 * by Supabase Auth's native recovery flow during the Clerk → Supabase migration.
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
    const password = body?.password;

    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters.", status: 400 },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: sessionData } = await supabase.auth.getUser();
    if (!sessionData.user) {
      return NextResponse.json(
        { error: "Reset link is invalid or expired. Request a new one.", status: 401 },
        { status: 401 }
      );
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message, status: 400 },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Password has been reset successfully." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
