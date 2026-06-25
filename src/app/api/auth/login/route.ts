import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

// Email-or-username password login. Supabase only signs in by email, so a
// username is resolved to its email here (server-side, so the email is never
// returned to the client). On success the Supabase server client sets the
// session cookies on this response.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!identifier || !password) {
    return NextResponse.json({ error: "Email/username and password required" }, { status: 400 });
  }

  let email: string | null = identifier.includes("@") ? identifier.toLowerCase() : null;
  if (!email) {
    const row = await prisma.user.findUnique({
      where: { username: identifier.toLowerCase() },
      select: { email: true },
    });
    email = row?.email ?? null;
  }
  // Generic message either way — don't reveal whether the account exists.
  if (!email) {
    return NextResponse.json({ error: "Invalid username/email or password" }, { status: 401 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: "Invalid username/email or password" }, { status: 401 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Signed in, but the account could not be loaded." }, { status: 500 });
  }
  return NextResponse.json({ user });
}
