import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/unified-auth";
import { locationInclude, serializeLocation } from "@/lib/serialize";
import { validateLocationBody, type LocationBody } from "@/lib/validate";
import { resolveCoverImage } from "@/lib/coverImage";

async function resolveCover(body: LocationBody): Promise<string | null> {
  if (body.coverImageUrl?.trim()) return body.coverImageUrl.trim();
  // Only auto-fetch on create when the user didn't pick a cover themselves.
  return resolveCoverImage({
    activityName: body.activityName!,
    city: body.city,
    region: body.region,
    countryName: body.countryName,
  });
}

/**
 * GET /api/locations
 *
 * Auth: optional (returns empty list for unauthenticated users).
 * Lists all saved locations (pins) for the current user.
 *
 * Response: { locations: Location[] }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ locations: [] });
    const locations = await prisma.location.findMany({
      where: { userId: user.id },
      include: locationInclude,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ locations: locations.map(serializeLocation) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * POST /api/locations
 *
 * Auth: required.
 * Creates a new saved location (pin on the map).
 *
 * Body: LocationBody (activityName, countryCode, latitude, longitude, etc.)
 * Response: { location: Location }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });

    const body: LocationBody | null = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON", status: 400 }, { status: 400 });
    const error = validateLocationBody(body);
    if (error) return NextResponse.json({ error, status: 400 }, { status: 400 });

    const coverImageUrl = await resolveCover(body);

    const created = await prisma.location.create({
      data: {
        userId: user.id,
        activityName: body.activityName!.trim(),
        countryCode: body.countryCode!.trim().toUpperCase(),
        countryName: body.countryName!.trim(),
        region: body.region?.trim() || null,
        city: body.city?.trim() || null,
        latitude: body.latitude!,
        longitude: body.longitude!,
        status: body.status ?? "TO_VISIT",
        notes: body.notes?.trim() || null,
        reminderAt: body.reminderAt ? new Date(body.reminderAt) : null,
        priceThreshold: body.priceThreshold ?? null,
        coverImageUrl,
        seasonSpring: body.seasonSpring ?? false,
        seasonSummer: body.seasonSummer ?? false,
        seasonFall: body.seasonFall ?? false,
        seasonWinter: body.seasonWinter ?? false,
        media: {
          create: (body.media ?? []).map((m, i) => ({
            type: m.type,
            url: m.url,
            caption: m.caption || null,
            sortOrder: i,
          })),
        },
      },
      include: locationInclude,
    });
    return NextResponse.json({ location: serializeLocation(created) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
