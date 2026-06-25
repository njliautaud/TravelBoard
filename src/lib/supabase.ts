/**
 * Supabase client utilities for TravelBoard.
 *
 * Provides:
 * - createBrowserSupabaseClient() — for use in client components
 * - createServerSupabaseClient() — for use in server components / API routes
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createBrowserClient } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars",
    );
  }
  return { url, anonKey };
}

/**
 * Create a Supabase client for use in browser / client components.
 * Safe to call multiple times — @supabase/ssr deduplicates internally.
 */
export function createBrowserSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}

/**
 * Create a Supabase client for use in server components, API route handlers,
 * and server actions.  Reads/writes cookies for session management.
 */
export async function createServerSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll can throw in server components where cookies are read-only.
          // This is expected — the middleware handles token refresh.
        }
      },
    },
  });
}
