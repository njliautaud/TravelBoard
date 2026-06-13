import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { locationInclude, serializeLocation } from "@/lib/serialize";

export const dynamic = "force-dynamic";

/** GET /api/hardware-sync — flat JSON for ESP32 (scoped to WHATSAPP_OWNER_USERNAME if set) */
export async function GET() {
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
}
