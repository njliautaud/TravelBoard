import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SETTINGS,
  normalizeHomeAirports,
  parseMapTheme,
  toDbMapTheme,
  type MapTheme,
  type UserSettings,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

function serialize(user: { mapTheme: string; homeAirports: string[] }): UserSettings {
  return {
    mapTheme: parseMapTheme(user.mapTheme),
    homeAirports: user.homeAirports ?? [],
  };
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ settings: DEFAULT_SETTINGS });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { mapTheme: true, homeAirports: true },
  });
  if (!user) return NextResponse.json({ settings: DEFAULT_SETTINGS });
  return NextResponse.json({ settings: serialize(user) });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: { mapTheme?: "CLASSIC" | "FLAG"; homeAirports?: string[] } = {};

  if (body.mapTheme !== undefined) {
    const theme = body.mapTheme as MapTheme;
    if (theme !== "classic" && theme !== "flag") {
      return NextResponse.json({ error: "Invalid mapTheme" }, { status: 400 });
    }
    data.mapTheme = toDbMapTheme(theme);
  }

  if (body.homeAirports !== undefined) {
    data.homeAirports = normalizeHomeAirports(body.homeAirports);
  }

  const updated = await prisma.user.update({
    where: { id: session.id },
    data,
    select: { mapTheme: true, homeAirports: true },
  });

  return NextResponse.json({ settings: serialize(updated) });
}
