#!/usr/bin/env npx tsx
/**
 * populate-deals.ts — One-shot script to populate TravelBoard with real deals.
 *
 * Usage:
 *   npx tsx scripts/populate-deals.ts
 *   npx tsx scripts/populate-deals.ts --origins JFK,LAX,ORD
 *   npx tsx scripts/populate-deals.ts --months 6,7,8
 *   npx tsx scripts/populate-deals.ts --skip-fares    # only award deals
 *   npx tsx scripts/populate-deals.ts --skip-awards   # only cash fares
 *
 * What it does:
 *   1. Fetches CASH FARES via Kiwi GraphQL (free, no API key) for each origin+month
 *      and upserts them into FareCache + FareHistory via the existing warmCache() service.
 *   2. Fetches AWARD DEALS via seats.aero bulk API (requires SEATSAERO_API_KEY)
 *      and upserts them into AwardCache via the same logic as /api/awards/refresh.
 *
 * Both data sources are real — when users open TravelBoard, they see actual deals.
 */

import { PrismaClient } from "@prisma/client";
import {
  KiwiGraphQLProvider,
  findAirport,
  SeatsAeroBulkAdapter,
  generateAwardDeals,
  VACATION_CODES,
  type FareQuote,
  type AwardDeal,
} from "@travelboard/core";

// --------------------------------------------------------------------------
// Config
// --------------------------------------------------------------------------

const DEFAULT_ORIGINS = ["JFK", "LAX", "ORD", "MIA", "SFO", "ATL", "DFW"];

function parseArgs() {
  const args = process.argv.slice(2);
  let origins = DEFAULT_ORIGINS;
  const now = new Date();
  const currentMonth = now.getMonth();
  // Default: current month + next 2 months
  let months = [currentMonth, (currentMonth + 1) % 12, (currentMonth + 2) % 12];
  let skipFares = false;
  let skipAwards = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--origins" && args[i + 1]) {
      origins = args[i + 1]!.split(",").map((s) => s.trim().toUpperCase());
      i++;
    }
    if (args[i] === "--months" && args[i + 1]) {
      months = args[i + 1]!
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => n >= 0 && n <= 11);
      i++;
    }
    if (args[i] === "--skip-fares") skipFares = true;
    if (args[i] === "--skip-awards") skipAwards = true;
  }

  return { origins, months, skipFares, skipAwards };
}

// --------------------------------------------------------------------------
// Prisma client (direct DB access, no HTTP server needed)
// --------------------------------------------------------------------------

const prisma = new PrismaClient();

// --------------------------------------------------------------------------
// Cash Fare Population (Kiwi GraphQL — free, no API key)
// --------------------------------------------------------------------------

/** Trimmed-median estimate (same as fares.ts service). */
function trimmedMedian(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * 0.1);
  const inner = sorted.slice(cut, sorted.length - cut);
  if (!inner.length) return sorted[Math.floor(sorted.length / 2)] ?? null;
  const mid = Math.floor(inner.length / 2);
  if (inner.length % 2 === 0) {
    return Math.round(((inner[mid - 1] ?? 0) + (inner[mid] ?? 0)) / 2);
  }
  return inner[mid] ?? null;
}

async function computeBaseline(
  origin: string,
  destination: string,
): Promise<number | null> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows = await prisma.fareHistory.findMany({
    where: { origin, destination, recordedAt: { gte: since } },
    select: { price: true },
  });
  if (rows.length < 5) return null;
  return trimmedMedian(rows.map((r) => r.price));
}

async function populateCashFares(
  origins: string[],
  months: number[],
): Promise<{ total: number; errors: number }> {
  const provider = new KiwiGraphQLProvider();
  let total = 0;
  let errors = 0;

  for (const originCode of origins) {
    const airport = findAirport(originCode);
    if (!airport) {
      console.error(`  Unknown airport: ${originCode}, skipping`);
      errors++;
      continue;
    }

    for (const month of months) {
      try {
        console.log(`  Fetching fares: ${originCode} month=${month}...`);

        const fares: FareQuote[] = await provider.getCheapest({
          origin: { code: airport.code, lat: airport.lat, lon: airport.lon },
          month,
        });

        if (fares.length === 0) {
          console.log(`    No fares found for ${originCode} month=${month}`);
          continue;
        }

        const observedAt = new Date();

        // Build history records
        const historyData = fares.map((f) => ({
          origin: originCode,
          destination: f.flyTo,
          month,
          price: f.price,
          source: f.gate ?? f.source ?? null,
          recordedAt: observedAt,
        }));

        // Compute deal scores against baselines
        const cacheData = await Promise.all(
          fares.map(async (f) => {
            const baseline = await computeBaseline(originCode, f.flyTo);
            const dealScore =
              baseline != null && baseline > 0
                ? Math.round(((baseline - f.price) / baseline) * 1000) / 1000
                : null;

            let tier: string | null = null;
            if (dealScore != null) {
              if (dealScore >= 0.3) tier = "cheap";
              else if (dealScore >= 0.1) tier = "fair";
              else tier = "splurge";
            }

            return {
              origin: originCode,
              destination: f.cityTo,
              flyToCode: f.flyTo,
              month,
              outboundDate: f.departDate ? new Date(f.departDate) : null,
              returnDate: f.returnDate ? new Date(f.returnDate) : null,
              price: f.price,
              currency: "USD",
              airline: f.gate ?? null,
              source: f.source ?? null,
              dealScore,
              tier,
              lastSeen: observedAt,
            };
          }),
        );

        // Transaction: delete old cache rows, insert new ones + history
        await prisma.$transaction([
          prisma.fareCache.deleteMany({
            where: { origin: originCode, month },
          }),
          ...cacheData.map((row) => prisma.fareCache.create({ data: row })),
          ...historyData.map((row) =>
            prisma.fareHistory.create({ data: row }),
          ),
        ]);

        total += cacheData.length;
        console.log(
          `    ${originCode} month=${month}: ${cacheData.length} fares cached`,
        );

        // Small delay to be polite to Kiwi
        await new Promise((r) => setTimeout(r, 1500));
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `    ${originCode} month=${month}: ERROR - ${msg}`,
        );
      }
    }
  }

  return { total, errors };
}

// --------------------------------------------------------------------------
// Award Deal Population (seats.aero — requires SEATSAERO_API_KEY)
// --------------------------------------------------------------------------

const AWARD_TTL_HOURS = 24;

async function populateAwardDeals(
  homeOrigin: string,
): Promise<{ upserted: number; expired: number }> {
  const apiKey = process.env.SEATSAERO_API_KEY;
  if (!apiKey) {
    console.log("  SEATSAERO_API_KEY not set, skipping award deals");
    return { upserted: 0, expired: 0 };
  }

  console.log(`  Fetching bulk award availability from seats.aero...`);

  const adapter = new SeatsAeroBulkAdapter({ apiKey });
  const records = await adapter.fetch();
  console.log(`  Got ${records.length} raw award availability records`);

  const vacationSet = new Set(VACATION_CODES);
  const deals: AwardDeal[] = generateAwardDeals(records, {
    resolveAirport: (code: string) => findAirport(code),
    vacationCodes: vacationSet,
    homeAirport: homeOrigin,
    limit: 500,
  });

  console.log(`  Generated ${deals.length} scored award deals`);

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + AWARD_TTL_HOURS * 60 * 60 * 1000,
  );

  let upserted = 0;
  for (const deal of deals) {
    try {
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
    } catch (err) {
      // Log but continue — one bad record shouldn't stop the batch
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    Award upsert failed for ${deal.flyFrom}-${deal.flyTo}: ${msg}`);
    }
  }

  // Clean up expired entries
  const deleted = await prisma.awardCache.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  return { upserted, expired: deleted.count };
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

async function main() {
  const { origins, months, skipFares, skipAwards } = parseArgs();

  console.log("=== TravelBoard Deal Population ===");
  console.log(`Origins: ${origins.join(", ")}`);
  console.log(`Months: ${months.join(", ")}`);
  console.log(`Skip fares: ${skipFares}, Skip awards: ${skipAwards}`);
  console.log("");

  // --- Cash Fares ---
  if (!skipFares) {
    console.log("--- Cash Fares (Kiwi GraphQL, no API key needed) ---");
    const { total, errors } = await populateCashFares(origins, months);
    console.log(`\nCash fares done: ${total} fares cached, ${errors} errors\n`);
  }

  // --- Award Deals ---
  if (!skipAwards) {
    console.log("--- Award Deals (seats.aero bulk) ---");
    // Use first origin as the home airport for deal anchoring
    const homeOrigin = origins[0] ?? "JFK";
    try {
      const { upserted, expired } = await populateAwardDeals(homeOrigin);
      console.log(
        `\nAward deals done: ${upserted} upserted, ${expired} expired deleted\n`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Award deals failed: ${msg}\n`);
    }
  }

  // --- Summary ---
  const fareCount = await prisma.fareCache.count();
  const awardCount = await prisma.awardCache.count();
  console.log("=== Final DB State ===");
  console.log(`FareCache rows: ${fareCount}`);
  console.log(`AwardCache rows: ${awardCount}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
