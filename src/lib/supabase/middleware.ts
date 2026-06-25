// Refreshes the Supabase auth session on every request and forwards the updated
// auth cookies onto both the request (so this render sees them) and the response
// (so the browser stores them). Without this, access tokens silently expire and
// users get logged out across reloads. Adapted from the Supabase Next.js guide.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // If the public env isn't configured yet, don't crash every request — just
  // pass through (the app's existing pages still render; auth simply won't work).
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touch the user to trigger a token refresh when needed. Do not run code
  // between createServerClient and getUser() or sessions can drop intermittently.
  await supabase.auth.getUser();

  return response;
}
