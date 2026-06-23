import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";


/**
 * GET /api/prefs
 *
 * Auth: required (returns defaults for unauthenticated).
 * Returns the authenticated user's travel preferences.
 *
 * Response: { prefs: { homeAirport, maxTravelHours, maxLayoverHours, cabin, nonstopOnly, tripStyles } }
 */
export async function GET() {
  try {
    const session = await getAuthUser();
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
      return NextResponse.json({ error: "User not found", status: 404 }, { status: 404 });
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * PUT /api/prefs
 *
 * Auth: required.
 * Updates the authenticated user's travel preferences.
 *
 * Body: { homeAirport?, maxTravelHours?, maxLayoverHours?, cabin?, nonstopOnly?, tripStyles? }
 * Response: { ok: true }
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthUser();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated", status: 401 }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body", status: 400 }, { status: 400 });
    }

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

    await prisma.user.update({
      where: { id: session.id },
      data: update,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
