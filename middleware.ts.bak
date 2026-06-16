import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isClerkEnabled = !!(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY
);

// Public routes that don't need auth
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/journal/(.*)",
  "/api/auth/(.*)",
  "/api/cover-image(.*)",
  "/api/image-proxy(.*)",
  "/api/geocode(.*)",
  "/api/hardware-sync(.*)",
  "/api/flight-prices(.*)",
  "/api/journal/(.*)/public",
  "/api/drafts/ingest",
]);

export default isClerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      // Allow public routes without auth
      if (isPublicRoute(req)) return NextResponse.next();
    })
  : function fallbackMiddleware() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
