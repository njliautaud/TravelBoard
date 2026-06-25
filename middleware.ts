import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/* -- CORS ------------------------------------------------ */
const ALLOWED_ORIGINS = [
  "https://travelboard-9q0.pages.dev",
  "http://localhost:3000",
  "http://localhost:3001",
];

function corsHeaders(origin: string | null) {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.some((o) => origin.startsWith(o))
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin!,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

/* -- Public routes (no auth required) --------------------- */
const PUBLIC_PATTERNS = [
  /^\/sign-in/,
  /^\/sign-up/,
  /^\/forgot-password/,
  /^\/api\/auth/,
  /^\/api\/onboarding/,
  /^\/api\/analytics/,
  /^\/api\/awards\/availability/,
  /^\/api\/cover-image/,
  /^\/api\/deals/,
  /^\/api\/destinations/,
  /^\/api\/drafts\/ingest/,
  /^\/api\/fares/,
  /^\/api\/fare-prediction/,
  /^\/api\/flight-prices/,
  /^\/api\/gamification\/badges/,
  /^\/api\/geocode/,
  /^\/api\/hardware-sync/,
  /^\/api\/image-proxy/,
  /^\/api\/journal\/[^/]+\/public/,
  /^\/api\/lounges/,
  /^\/api\/loyalty\/programs/,
  /^\/api\/loyalty\/transfers/,
  /^\/api\/packing/,
  /^\/api\/points\/calculator/,
  /^\/api\/points\/sweet-spots/,
  /^\/api\/search/,
  /^\/api\/track/,
  /^\/$/,
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATTERNS.some((p) => p.test(pathname));
}

/* -- Supabase enabled check ------------------------------- */
const supabaseEnabled = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/* -- Combined middleware ---------------------------------- */
export default async function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");

  // Handle preflight OPTIONS
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  let res = NextResponse.next({
    request: { headers: req.headers },
  });

  // CORS headers for API routes
  if (req.nextUrl.pathname.startsWith("/api/")) {
    const headers = corsHeaders(origin);
    for (const [key, value] of Object.entries(headers)) {
      res.headers.set(key, value);
    }
  }

  if (!supabaseEnabled) {
    return res;
  }

  // Create Supabase client that can refresh tokens via middleware cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update request cookies (for downstream server components)
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value),
          );
          // Re-create response so it carries the updated request headers
          res = NextResponse.next({
            request: { headers: req.headers },
          });
          // Set cookies on the response (for the browser)
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session (important: keeps tokens alive)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect non-public routes: redirect unauthenticated users to /sign-in
  if (!user && !isPublicRoute(req.nextUrl.pathname)) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return res;
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
