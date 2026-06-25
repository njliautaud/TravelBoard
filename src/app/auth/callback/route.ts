import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

// OAuth / email-confirmation landing. Supabase redirects here with a `code`
// which we exchange for a session (cookies set via the server client). We then
// provision/claim the Prisma row eagerly so the app is fully ready on first load.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // `next` lets a caller redirect somewhere specific; default to the app root.
  const next = url.searchParams.get("next") ?? "/";

  // Build the redirect target from the Host the browser actually used — NOT from
  // request.url. The dev server binds 0.0.0.0, so request.url would yield an
  // unreachable http://0.0.0.0:3000; the Host header reflects localhost / the
  // Tailscale IP / the Vercel domain correctly. Honors proxy headers on Vercel.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const base = `${proto}://${host}`;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await getSessionUser(); // create/claim the Prisma user now, not lazily
      return NextResponse.redirect(`${base}${next}`);
    }
  }

  // Something went wrong (expired/invalid code) — bounce home with a flag the
  // client can surface as an error toast.
  return NextResponse.redirect(`${base}/?auth_error=1`);
}
