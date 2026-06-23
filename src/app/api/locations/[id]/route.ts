import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/unified-auth";
import { locationInclude, serializeLocation } from "@/lib/serialize";
import { validateLocationBody, type LocationBody } from "@/lib/validate";

type Params = { params: Promise<{ id: string }> };

async function owned(id: string, userId: string) {
  return prisma.location.findFirst({ where: { id, userId } });
}

/**
 * GET /api/locations/:id
 *
 * Auth: optional (ownership check applied if authenticated).
 * Returns a single location by ID.
 *
 * Response: { location: Location }
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const location = await prisma.location.findUnique({ where: { id }, include: locationInclude });
    if (!location) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    if (user && location.userId !== user.id) {
      return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    }
    return NextResponse.json({ location: serializeLocation(location) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * PATCH /api/locations/:id
 *
 * Auth: required (must own the location).
 * Updates a saved location.
 *
 * Body: LocationBody
 * Response: { location: Location }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    const { id } = await params;
    const existing = await owned(id, user.id);
    if (!existing) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });

    const body: LocationBody | null = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON", status: 400 }, { status: 400 });
    const error = validateLocationBody(body);
    if (error) return NextResponse.json({ error, status: 400 }, { status: 400 });

    const coverImageUrl = body.coverImageUrl?.trim() || null;

    const updated = await prisma.location.update({
      where: { id },
      data: {
        activityName: body.activityName!.trim(),
        countryCode: body.countryCode!.trim().toUpperCase(),
        countryName: body.countryName!.trim(),
        region: body.region?.trim() || null,
        city: body.city?.trim() || null,
        latitude: body.latitude!,
        longitude: body.longitude!,
        status: body.status ?? existing.status,
        notes: body.notes?.trim() || null,
        reminderAt: body.reminderAt ? new Date(body.reminderAt) : null,
        priceThreshold: body.priceThreshold ?? null,
        coverImageUrl,
        seasonSpring: body.seasonSpring ?? false,
        seasonSummer: body.seasonSummer ?? false,
        seasonFall: body.seasonFall ?? false,
        seasonWinter: body.seasonWinter ?? false,
        media: {
          deleteMany: {},
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
    return NextResponse.json({ location: serializeLocation(updated) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * DELETE /api/locations/:id
 *
 * Auth: required (must own the location).
 * Deletes a saved location.
 *
 * Response: { ok: true }
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized", status: 401 }, { status: 401 });
    const { id } = await params;
    const existing = await owned(id, user.id);
    if (!existing) return NextResponse.json({ error: "Not found", status: 404 }, { status: 404 });
    await prisma.location.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
