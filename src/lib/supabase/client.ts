// Browser-side Supabase client for Auth (email/password sign-in/up + OAuth).
// Uses the public anon key; the @supabase/ssr browser client reads/writes the
// session in cookies so the server (middleware + server client) can see it too.
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Check your Supabase project's API settings.",
    );
  }
  return createBrowserClient(url, key);
}
