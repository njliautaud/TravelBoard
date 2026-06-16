import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { locationInclude, serializeLocation } from "@/lib/serialize";
import { validateLocationBody, type LocationBody } from "@/lib/validate";


type Params = { params: Promise<{ id: string }> };

async function owned(id: string, userId: string) {
  return prisma.location.findFirst({ where: { id, userId } });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  const { id } = await params;
  const location = await prisma.location.findUnique({ where: { id }, include: locationInclude });
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user && location.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ location: serializeLocation(location) });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await owned(id, user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body: LocationBody | null = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const error = validateLocationBody(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  // Respect explicit clears — never restore a deleted cover or auto-fetch on edit.
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
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await owned(id, user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.location.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
