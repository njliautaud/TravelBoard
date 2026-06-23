import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { locationInclude, serializeLocation } from "@/lib/serialize";
import { validateLocationBody, type LocationBody } from "@/lib/validate";
import { resolveCoverImage } from "@/lib/coverImage";

export const dynamic = "force-dynamic";

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

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ locations: [] });
  // Any logged-in user may view another user's board read-only (?userId=...).
  // Omitted ⇒ your own board. Editing stays owner-only on the mutating routes.
  const requested = req.nextUrl.searchParams.get("userId")?.trim();
  const targetUserId = requested || user.id;
  const locations = await prisma.location.findMany({
    where: { userId: targetUserId },
    include: locationInclude,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ locations: locations.map(serializeLocation) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: LocationBody | null = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const error = validateLocationBody(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

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
}
