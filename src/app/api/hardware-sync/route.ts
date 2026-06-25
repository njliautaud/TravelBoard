import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { locationInclude, serializeLocation } from "@/lib/serialize";
import { findTopDeals } from "@/lib/services/fares";


/**
 * GET /api/hardware-sync
 *
 * Auth: none (public -- designed for ESP32 / IoT devices).
 * Returns flat JSON of locations, scoped to WHATSAPP_OWNER_USERNAME if set.
 *
 * Also returns (backward-compatible, new fields):
 *   - topDeals: top 3 flight deals from user's homeAirports
 *   - nextTrip: the next upcoming trip (PLANNED or BOOKED)
 *
 * Response: { generatedAt, count, locations, topDeals?, nextTrip? }
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
      countryName: l.countryName,
      city: l.city,
      region: l.region,
      status: l.status,
      notes: l.notes,
      isDeal: l.isDeal,
      latestPrice: l.latestPrice?.price ?? null,
      priceCurrency: l.latestPrice?.currency ?? null,
      coverImageUrl: l.coverImageUrl ?? null,
    }));

    // --- Flight deals from user's homeAirports (new, backward-compatible) ---
    let topDeals: Array<{
      destination: string;
      price: number;
      currency: string;
      dealScore: number;
      origin: string;
    }> = [];

    let nextTrip: {
      name: string;
      city: string;
      startDate: string | null;
      endDate: string | null;
      status: string;
    } | null = null;

    if (owner) {
      // Fetch user's homeAirports for deal filtering
      let homeAirports: string[] = [];
      try {
        const rawAirports = owner.homeAirports;
        if (typeof rawAirports === "string") {
          homeAirports = JSON.parse(rawAirports || "[]");
        } else if (Array.isArray(rawAirports)) {
          homeAirports = rawAirports;
        }
      } catch {
        // homeAirports parse failed — skip deals
      }

      // Top 3 deals from homeAirports
      if (homeAirports.length > 0) {
        try {
          const allDeals = await Promise.all(
            homeAirports.map((apt) => findTopDeals(apt, 3))
          );
          const merged = allDeals
            .flat()
            .sort((a, b) => (b.dealScore ?? 0) - (a.dealScore ?? 0))
            .slice(0, 3);
          topDeals = merged.map((d) => ({
            destination: d.destination,
            price: d.price,
            currency: d.currency,
            dealScore: d.dealScore ?? 0,
            origin: d.origin,
          }));
        } catch {
          // Deal fetch failed — serve without deals
        }
      }

      // Next upcoming trip (PLANNED or BOOKED, soonest startDate)
      try {
        const trip = await prisma.tripPlan.findFirst({
          where: {
            userId: owner.id,
            status: { in: ["PLANNED", "BOOKED"] },
            startDate: { gte: new Date() },
          },
          orderBy: { startDate: "asc" },
          select: {
            name: true,
            startDate: true,
            endDate: true,
            status: true,
            legs: {
              orderBy: { sortOrder: "asc" },
              take: 1,
              select: { destination: true },
            },
          },
        });
        if (trip) {
          nextTrip = {
            name: trip.name,
            city: trip.legs[0]?.destination ?? trip.name,
            startDate: trip.startDate?.toISOString() ?? null,
            endDate: trip.endDate?.toISOString() ?? null,
            status: trip.status,
          };
        }
      } catch {
        // Trip fetch failed — serve without trip info
      }
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      count: items.length,
      locations: items,
      ...(topDeals.length > 0 ? { topDeals } : {}),
      ...(nextTrip ? { nextTrip } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
