import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/* ── CORS ─────────────────────────────────────────────── */
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

/* ── Public routes (no auth required) ─────────────────── */
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Public API routes: auth endpoints, public data, webhook ingestion, hardware sync
  "/api/auth(.*)",
  "/api/onboarding(.*)",
  "/api/analytics(.*)",
  "/api/awards/availability(.*)",
  "/api/cover-image(.*)",
  "/api/deals(.*)",
  "/api/destinations(.*)",
  "/api/drafts/ingest(.*)",
  "/api/fares(.*)",
  "/api/fare-prediction(.*)",
  "/api/flight-prices(.*)",
  "/api/gamification/badges(.*)",
  "/api/geocode(.*)",
  "/api/hardware-sync(.*)",
  "/api/image-proxy(.*)",
  "/api/journal/:id/public(.*)",
  "/api/lounges(.*)",
  "/api/loyalty/programs(.*)",
  "/api/loyalty/transfers(.*)",
  "/api/packing(.*)",
  "/api/points/calculator(.*)",
  "/api/points/sweet-spots(.*)",
  "/api/search(.*)",
  "/api/track(.*)",
  "/",
]);

/* ── Clerk enabled check ──────────────────────────────── */
const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/* ── Combined middleware ──────────────────────────────── */
function corsFallback(req: NextRequest) {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  const res = NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    const headers = corsHeaders(origin);
    for (const [key, value] of Object.entries(headers)) {
      res.headers.set(key, value);
    }
  }

  return res;
}

const clerkMw = clerkMiddleware(async (auth, req) => {
  const origin = req.headers.get("origin");

  // Handle preflight OPTIONS
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  // Protect non-public routes
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  const res = NextResponse.next();

  // CORS headers for API routes
  if (req.nextUrl.pathname.startsWith("/api/")) {
    const headers = corsHeaders(origin);
    for (const [key, value] of Object.entries(headers)) {
      res.headers.set(key, value);
    }
  }

  return res;
});

export default function middleware(req: NextRequest) {
  if (!clerkEnabled) {
    return corsFallback(req);
  }
  // clerkMiddleware returns a function that takes (req, event)
  return (clerkMw as (req: NextRequest) => Response | Promise<Response>)(req);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
