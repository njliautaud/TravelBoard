import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SETTINGS,
  normalizeHomeAirports,
  normalizeVisitedRegions,
  parseMapTheme,
  toDbMapTheme,
  type MapTheme,
  type UserSettings,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

const SETTINGS_SELECT = {
  mapTheme: true,
  homeAirports: true,
  usaAsStates: true,
  visitedRegions: true,
  passportOnboardedAt: true,
} as const;

function serialize(user: {
  mapTheme: string;
  homeAirports: string[];
  usaAsStates: boolean;
  visitedRegions: string[];
}): UserSettings {
  return {
    mapTheme: parseMapTheme(user.mapTheme),
    homeAirports: user.homeAirports ?? [],
    usaAsStates: user.usaAsStates ?? false,
    visitedRegions: user.visitedRegions ?? [],
  };
}

export async function GET() {
  const session = await getAuthUser();
  if (!session) return NextResponse.json({ settings: DEFAULT_SETTINGS });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: SETTINGS_SELECT,
  });
  if (!user) return NextResponse.json({ settings: DEFAULT_SETTINGS });
  return NextResponse.json({
    settings: serialize(user),
    needsPassportOnboarding: user.passportOnboardedAt === null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getAuthUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: {
    mapTheme?: "CLASSIC" | "FLAG";
    homeAirports?: string[];
    usaAsStates?: boolean;
    visitedRegions?: string[];
    passportOnboardedAt?: Date;
  } = {};

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

  if (body.usaAsStates !== undefined) {
    data.usaAsStates = Boolean(body.usaAsStates);
  }

  if (body.visitedRegions !== undefined) {
    data.visitedRegions = normalizeVisitedRegions(body.visitedRegions);
  }

  // Mark the "map where you've been" onboarding as finished/dismissed (one-shot).
  if (body.passportOnboarded === true) {
    data.passportOnboardedAt = new Date();
  }

  const updated = await prisma.user.update({
    where: { id: session.id },
    data,
    select: SETTINGS_SELECT,
  });

  return NextResponse.json({
    settings: serialize(updated),
    needsPassportOnboarding: updated.passportOnboardedAt === null,
  });
}
