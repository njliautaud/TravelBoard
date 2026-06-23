import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { countryNameToISO2 } from "@/lib/api-utils";


/**
 * GET /api/deals/countries
 *
 * Public endpoint. Returns deal data grouped by country (destination airport
 * country code). Used by the map to color countries by deal quality.
 *
 * Response: { deals: Array<{ countryCode, cheapestPrice, tier, bestDealScore }> }
 */
export async function GET() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fares = await prisma.fareCache.findMany({
      where: { lastSeen: { gte: sevenDaysAgo } },
      orderBy: { price: "asc" },
      select: {
        flyToCode: true,
        destination: true,
        price: true,
        dealScore: true,
        tier: true,
        origin: true,
      },
    });

    const { findAirport } = await import("@travelboard/core");
    const { alpha2ToAlpha3 } = await import("@/lib/countryCodes");

    const countryMap = new Map<
      string,
      { countryCode: string; cheapestPrice: number; tier: string; bestDealScore: number }
    >();

    for (const fare of fares) {
      const airport = findAirport(fare.flyToCode);
      if (!airport) continue;

      const cc2 = countryNameToISO2(airport.country);
      const cc3 = cc2 ? alpha2ToAlpha3(cc2) : null;
      if (!cc3) continue;

      const price = Number(fare.price);
      const tier = fare.tier ?? (price < 200 ? "cheap" : price < 500 ? "fair" : "splurge");
      const existing = countryMap.get(cc3);
      if (!existing || price < existing.cheapestPrice) {
        countryMap.set(cc3, {
          countryCode: cc3,
          cheapestPrice: price,
          tier,
          bestDealScore: fare.dealScore ?? 0.5,
        });
      }
    }

    const deals = [...countryMap.values()];
    return NextResponse.json({ deals });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
