import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SETTINGS,
  normalizeHomeAirports,
  parseMapTheme,
  toDbMapTheme,
  type MapTheme,
  type UserSettings,
} from "@/lib/settings";


function serialize(user: { mapTheme: string; homeAirports: string }): UserSettings {
  let airports: string[] = [];
  try {
    airports = JSON.parse(user.homeAirports || "[]");
  } catch {
    airports = [];
  }
  return {
    mapTheme: parseMapTheme(user.mapTheme),
    homeAirports: airports,
  };
}

/**
 * GET /api/settings
 *
 * Auth: optional (returns defaults for unauthenticated users).
 * Returns the user's app settings (map theme, home airports).
 *
 * Response: { settings: { mapTheme, homeAirports } }
 */
export async function GET() {
  try {
    const session = await getAuthUser();
    if (!session) return NextResponse.json({ settings: DEFAULT_SETTINGS });

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { mapTheme: true, homeAirports: true },
    });
    if (!user) return NextResponse.json({ settings: DEFAULT_SETTINGS });
    return NextResponse.json({ settings: serialize(user) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * PATCH /api/settings
 *
 * Auth: required.
 * Updates the user's app settings.
 *
 * Body: { mapTheme?: "classic" | "flag", homeAirports?: string[] }
 * Response: { settings: { mapTheme, homeAirports } }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthUser();
    if (!session) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON", status: 400 }, { status: 400 });
    }

    const data: { mapTheme?: "CLASSIC" | "FLAG"; homeAirports?: string } = {};

    if (body.mapTheme !== undefined) {
      const theme = body.mapTheme as MapTheme;
      if (theme !== "classic" && theme !== "flag") {
        return NextResponse.json({ error: "Invalid mapTheme", status: 400 }, { status: 400 });
      }
      data.mapTheme = toDbMapTheme(theme);
    }

    if (body.homeAirports !== undefined) {
      data.homeAirports = JSON.stringify(normalizeHomeAirports(body.homeAirports));
    }

    const updated = await prisma.user.update({
      where: { id: session.id },
      data,
      select: { mapTheme: true, homeAirports: true },
    });

    return NextResponse.json({ settings: serialize(updated) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
