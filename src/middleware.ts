import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

function addCorsHeaders(res: NextResponse, origin: string | null, pathname: string) {
  if (pathname.startsWith("/api/")) {
    const headers = corsHeaders(origin);
    for (const [key, value] of Object.entries(headers)) {
      res.headers.set(key, value);
    }
  }
}

export default async function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");

  // Handle preflight OPTIONS
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }

  // When Clerk is enabled, dynamically import and use clerkMiddleware
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    try {
      const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server");
      const isPublicRoute = createRouteMatcher([
        "/sign-in(.*)",
        "/sign-up(.*)",
        "/api(.*)",
        "/",
      ]);

      const handler = clerkMiddleware(async (auth, innerReq) => {
        if (!isPublicRoute(innerReq)) {
          await auth.protect();
        }
        const res = NextResponse.next();
        addCorsHeaders(res, origin, innerReq.nextUrl.pathname);
        return res;
      });

      return (handler as (req: NextRequest) => Response | Promise<Response>)(req);
    } catch {
      // Clerk import failed — fall through to CORS-only
    }
  }

  // CORS-only fallback when Clerk is not configured
  const res = NextResponse.next();
  addCorsHeaders(res, origin, req.nextUrl.pathname);
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
