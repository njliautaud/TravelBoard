import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { locationInclude, serializeLocation } from "@/lib/serialize";


/**
 * GET /api/hardware-sync
 *
 * Auth: none (public -- designed for ESP32 / IoT devices).
 * Returns flat JSON of locations, scoped to WHATSAPP_OWNER_USERNAME if set.
 *
 * Response: { generatedAt, count, locations: Array<{ id, name, lat, lng, countryCode, status, isDeal }> }
 */
export async function GET() {
  try {
    const ownerName = process.env.WHATSAPP_OWNER_USERNAME?.trim().toLowerCase();
    const owner = ownerName
      ? await prisma.user.findUnique({ where: { username: ownerName } })
      : null;

    const locations = await prisma.location.findMany({
      where: owner ? { userId: owner.id } : undefined,
      include: locationInclude,
      orderBy: { createdAt: "asc" },
    });

    const items = locations.map(serializeLocation).map((l) => ({
      id: l.id,
      name: l.activityName,
      lat: l.latitude,
      lng: l.longitude,
      countryCode: l.countryCode,
      status: l.status,
      isDeal: l.isDeal,
    }));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      count: items.length,
      locations: items,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
