import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/onboarding
 *
 * Auth: required (Supabase Auth). Anonymous onboarding is no longer supported —
 * the wizard runs AFTER signup per HC #631 (login required).
 *
 * Body: { airports: string[], flightPref: string, distancePref: string, loyaltyPrograms: string[] }
 * Response: { ok: true, userId: string }
 *
 * Note: homeAirports / loyaltyPrograms are native String[] columns post-merge.
 * The legacy JSON.stringify path was removed during HC #650/#651.
 */
export async function POST(req: NextRequest) {
  let body: {
    airports?: string[];
    flightPref?: string;
    distancePref?: string;
    loyaltyPrograms?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", status: 400 }, { status: 400 });
  }

  try {
    const airports = Array.isArray(body.airports)
      ? body.airports.filter((a): a is string => typeof a === "string" && /^[A-Z]{3}$/.test(a))
      : [];
    const flightPref = ["international", "domestic", "both"].includes(body.flightPref ?? "")
      ? body.flightPref!
      : "both";
    const distancePref = ["farther", "nearby", "no_preference"].includes(body.distancePref ?? "")
      ? body.distancePref!
      : "no_preference";
    const loyaltyPrograms = Array.isArray(body.loyaltyPrograms)
      ? body.loyaltyPrograms.filter((p): p is string => typeof p === "string")
      : [];
    // Derive preferFarther from distance preference for backward compatibility
    const preferFarther = distancePref === "farther";

    const session = await getAuthUser();
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required", status: 401 },
        { status: 401 }
      );
    }

    await prisma.user.update({
      where: { id: session.id },
      data: {
        homeAirports: airports,
        flightPref,
        distancePref,
        preferFarther,
        loyaltyPrograms,
        onboarded: true,
      },
    });

    return NextResponse.json({ ok: true, userId: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * GET /api/onboarding — check if current user has completed onboarding.
 */
export async function GET() {
  const session = await getAuthUser();
  if (!session) {
    return NextResponse.json({ onboarded: false });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      onboarded: true,
      homeAirports: true,
      flightPref: true,
      distancePref: true,
      preferFarther: true,
      loyaltyPrograms: true,
    },
  });

  if (!user) {
    return NextResponse.json({ onboarded: false });
  }

  return NextResponse.json({
    onboarded: user.onboarded,
    airports: user.homeAirports ?? [],
    flightPref: user.flightPref,
    distancePref: user.distancePref,
    preferFarther: user.preferFarther,
    loyaltyPrograms: user.loyaltyPrograms ?? [],
  });
}
