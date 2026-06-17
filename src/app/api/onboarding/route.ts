import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/onboarding
 * Body: { airports: string[], flightPref: string, loyaltyPrograms: string[] }
 *
 * Saves onboarding preferences. Creates a default user if none exists (anonymous).
 */
export async function POST(req: NextRequest) {
  let body: {
    airports?: string[];
    flightPref?: string;
    loyaltyPrograms?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const airports = Array.isArray(body.airports)
    ? body.airports.filter((a): a is string => typeof a === "string" && /^[A-Z]{3}$/.test(a))
    : [];
  const flightPref = ["international", "domestic", "both"].includes(body.flightPref ?? "")
    ? body.flightPref!
    : "both";
  const loyaltyPrograms = Array.isArray(body.loyaltyPrograms)
    ? body.loyaltyPrograms.filter((p): p is string => typeof p === "string")
    : [];

  // Try to find existing user, or create one
  let session = await getSessionUser();
  let userId: string;

  if (session) {
    userId = session.id;
  } else {
    // Create anonymous user for onboarding
    const user = await prisma.user.create({
      data: {
        username: `traveler_${Date.now().toString(36)}`,
        passwordHash: "",
        homeAirports: JSON.stringify(airports),
        flightPref,
        loyaltyPrograms: JSON.stringify(loyaltyPrograms),
        onboarded: true,
      },
    });
    userId = user.id;

    // Set session cookie
    const { createSessionToken, SESSION_COOKIE } = await import("@/lib/auth");
    const token = createSessionToken(userId);
    const res = NextResponse.json({ ok: true, userId });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });
    return res;
  }

  // Update existing user
  await prisma.user.update({
    where: { id: userId },
    data: {
      homeAirports: JSON.stringify(airports),
      flightPref,
      loyaltyPrograms: JSON.stringify(loyaltyPrograms),
      onboarded: true,
    },
  });

  return NextResponse.json({ ok: true, userId });
}

/**
 * GET /api/onboarding — check if current user has completed onboarding
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ onboarded: false });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      onboarded: true,
      homeAirports: true,
      flightPref: true,
      loyaltyPrograms: true,
    },
  });

  if (!user) {
    return NextResponse.json({ onboarded: false });
  }

  let airports: string[] = [];
  try { airports = JSON.parse(user.homeAirports || "[]"); } catch {}
  let programs: string[] = [];
  try { programs = JSON.parse(user.loyaltyPrograms || "[]"); } catch {}

  return NextResponse.json({
    onboarded: user.onboarded,
    airports,
    flightPref: user.flightPref,
    loyaltyPrograms: programs,
  });
}
