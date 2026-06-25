// Server-side Supabase client (Server Components, Route Handlers, server actions).
// Reads the auth session from the request cookies and writes refreshed tokens
// back, so logins survive page reloads. The cookie setter is wrapped in try/catch
// because Server Components can't set cookies — middleware handles refresh there.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, which cannot mutate cookies.
            // Safe to ignore: middleware refreshes the session on every request.
          }
        },
      },
    },
  );
}
