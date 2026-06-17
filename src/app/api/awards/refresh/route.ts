import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SeatsAeroBulkAdapter,
  generateAwardDeals,
  findAirport,
  VACATION_CODES,
  type AwardDeal,
} from "@travelboard/core";

const AWARD_TTL_HOURS = 24;

/**
 * POST /api/awards/refresh?origin=MCO
 *
 * Fetches fresh award data from seats.aero, scores it via generateAwardDeals,
 * upserts results into AwardCache, and cleans up expired entries.
 *
 * Called periodically (e.g. every 12h via cron) to keep award deals fresh
 * without hammering the API on every page load.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.SEATSAERO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Award availability not configured (no API key)" },
      { status: 503 },
    );
  }

  const origin = req.nextUrl.searchParams.get("origin")?.toUpperCase() ?? "MCO";

  try {
    // 1. Fetch fresh data from seats.aero
    const adapter = new SeatsAeroBulkAdapter({ apiKey });
    const records = await adapter.fetch();

    const vacationSet = new Set(VACATION_CODES);
    const deals = generateAwardDeals(records, {
      resolveAirport: (code: string) => findAirport(code),
      vacationCodes: vacationSet,
      homeAirport: origin,
      limit: 500, // generous limit for caching — endpoints will filter/limit on read
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + AWARD_TTL_HOURS * 60 * 60 * 1000);

    // 2. Upsert all deals into AwardCache
    let upserted = 0;
    for (const deal of deals) {
      await prisma.awardCache.upsert({
        where: {
          origin_destination_program_cabin_date: {
            origin: deal.flyFrom,
            destination: deal.flyTo,
            program: deal.program,
            cabin: deal.cabin,
            date: deal.date ?? "",
          },
        },
        update: {
          miles: deal.miles,
          taxesUsd: deal.taxesUsd,
          airlines: deal.airlines,
          remainingSeats: deal.seatsLeft,
          score: deal.score,
          destCity: deal.cityTo,
          destCountry: deal.countryTo,
          destLat: deal.lat,
          destLon: deal.lon,
          cabinLabel: deal.cabinLabel,
          programName: deal.programName,
          programSource: deal.program,
          tripType: deal.tripType,
          returnDate: deal.returnDate,
          nights: deal.nights,
          homeAnchored: deal.homeAnchored,
          isIntl: deal.intl,
          fetchedAt: now,
          expiresAt,
        },
        create: {
          origin: deal.flyFrom,
          destination: deal.flyTo,
          program: deal.program,
          programName: deal.programName,
          programSource: deal.program,
          cabin: deal.cabin,
          cabinLabel: deal.cabinLabel,
          miles: deal.miles,
          taxesUsd: deal.taxesUsd,
          airlines: deal.airlines,
          date: deal.date,
          returnDate: deal.returnDate,
          remainingSeats: deal.seatsLeft,
          score: deal.score,
          destCity: deal.cityTo,
          destCountry: deal.countryTo,
          destLat: deal.lat,
          destLon: deal.lon,
          tripType: deal.tripType,
          nights: deal.nights,
          homeAnchored: deal.homeAnchored,
          isIntl: deal.intl,
          fetchedAt: now,
          expiresAt,
        },
      });
      upserted++;
    }

    // 3. Delete expired entries
    const deleted = await prisma.awardCache.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    return NextResponse.json({
      ok: true,
      origin,
      upserted,
      expired_deleted: deleted.count,
      next_expiry: expiresAt.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
