import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/prefs — return travel preferences for the current user.
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({
      prefs: {
        homeAirport: "MCO",
        maxTravelHours: 24,
        maxLayoverHours: 8,
        cabin: "any",
        nonstopOnly: false,
        tripStyles: [],
      },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      homeAirports: true,
      maxTravelHours: true,
      maxLayoverHours: true,
      cabin: true,
      nonstopOnly: true,
      tripStyles: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let airports: string[] = [];
  try { airports = JSON.parse(user.homeAirports || "[]"); } catch {}

  let styles: string[] = [];
  try { styles = JSON.parse(user.tripStyles || "[]"); } catch {}

  return NextResponse.json({
    prefs: {
      homeAirport: airports[0] ?? "MCO",
      maxTravelHours: user.maxTravelHours,
      maxLayoverHours: user.maxLayoverHours,
      cabin: user.cabin,
      nonstopOnly: user.nonstopOnly,
      tripStyles: styles,
    },
  });
}

/**
 * PUT /api/prefs — update travel preferences.
 */
export async function PUT(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const {
    homeAirport,
    maxTravelHours,
    maxLayoverHours,
    cabin,
    nonstopOnly,
    tripStyles,
  } = body;

  const update: Record<string, unknown> = {};

  if (typeof homeAirport === "string" && /^[A-Z]{3}$/.test(homeAirport)) {
    update.homeAirports = JSON.stringify([homeAirport]);
  }
  if (typeof maxTravelHours === "number") {
    update.maxTravelHours = Math.min(72, Math.max(4, maxTravelHours));
  }
  if (typeof maxLayoverHours === "number") {
    update.maxLayoverHours = Math.min(48, Math.max(1, maxLayoverHours));
  }
  if (cabin === "economy" || cabin === "premium" || cabin === "any") {
    update.cabin = cabin;
  }
  if (typeof nonstopOnly === "boolean") {
    update.nonstopOnly = nonstopOnly;
  }
  if (Array.isArray(tripStyles)) {
    update.tripStyles = JSON.stringify(tripStyles.filter((s: unknown) => typeof s === "string"));
  }

  const user = await prisma.user.update({
    where: { id: session.id },
    data: update,
  });

  return NextResponse.json({ ok: true });
}
