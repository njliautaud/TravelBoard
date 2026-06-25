import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, validateUsername } from "@/lib/auth";

/**
 * POST /api/auth/register
 *
 * Auth: none (public).
 * Creates a new user account via Supabase Auth (email/password) and provisions
 * the Prisma user row. Rate limiting is handled by Supabase.
 *
 * Body: { username: string, email: string, password: string }
 * Response: { user: { id, username } } or { notice: string } if email confirmation required
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!username || !email || !password) {
      return NextResponse.json({ error: "Username, email, and password required" }, { status: 400 });
    }

    const uErr = validateUsername(username);
    if (uErr) return NextResponse.json({ error: uErr }, { status: 400 });

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${req.nextUrl.origin}/auth/callback`,
      },
    });

    if (signErr) {
      return NextResponse.json({ error: signErr.message }, { status: 400 });
    }

    if (!data.session) {
      // Email confirmation is enabled — no session yet.
      return NextResponse.json({ notice: "Check your email to confirm your account, then sign in." });
    }

    // Session established — provision the Prisma row.
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Account created but could not be loaded." }, { status: 500 });
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
