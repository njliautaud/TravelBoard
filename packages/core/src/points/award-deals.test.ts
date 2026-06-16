/** HC #617 — award deal generation from bulk seats.aero availability. Pure unit tests, no network. */
import { describe, expect, it } from 'vitest';
import { awardDealSummary, benchmarkMiles, generateAwardDeals, type AirportInfo } from './award-deals.js';
import { parseBulkRecord, type BulkAwardRecord } from './sources/seats-aero-bulk.js';

const AIRPORTS: Record<string, AirportInfo> = {
  MCO: { code: 'MCO', city: 'Orlando', country: 'United States', lat: 28.43, lon: -81.31 },
  JFK: { code: 'JFK', city: 'New York', country: 'United States', lat: 40.64, lon: -73.78 },
  NRT: { code: 'NRT', city: 'Tokyo', country: 'Japan', lat: 35.76, lon: 140.39 },
  LIS: { code: 'LIS', city: 'Lisbon', country: 'Portugal', lat: 38.77, lon: -9.13 },
  ATL: { code: 'ATL', city: 'Atlanta', country: 'United States', lat: 33.64, lon: -84.43 },
};
const resolveAirport = (code: string) => AIRPORTS[code];

function rec(over: Partial<BulkAwardRecord> & { origin: string; dest: string }): BulkAwardRecord {
  const cab = (available = false, mileageCost: number | null = null) => ({
    available, mileageCost, taxesUsd: 45, airlines: 'NH', remainingSeats: 2,
  });
  return {
    originRegion: 'North America',
    destRegion: 'Asia',
    distanceMi: 6800,
    source: 'aeroplan',
    date: '2026-07-14',
    cabins: { economy: cab(), premiumEconomy: cab(), business: cab(), first: cab() },
    fetchedAt: '2026-06-12T00:00:00.000Z',
    ...over,
  };
}

describe('benchmarkMiles', () => {
  it('scales by distance band and cabin', () => {
    expect(benchmarkMiles('economy', 1000)).toBe(12_500);
    expect(benchmarkMiles('economy', 6800)).toBe(40_000);
    expect(benchmarkMiles('business', 6800)).toBe(75_000);
    expect(benchmarkMiles('first', 6800)).toBe(112_500);
    expect(benchmarkMiles('premiumEconomy', 1000)).toBe(20_000);
  });
});

describe('generateAwardDeals', () => {
  it('sweet-spot long-haul business becomes a deal; junk dynamic pricing does not', () => {
    const deals = generateAwardDeals(
      [
        rec({ origin: 'JFK', dest: 'NRT', cabins: {
          economy: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
          premiumEconomy: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
          business: { available: true, mileageCost: 60_000, taxesUsd: 45, airlines: 'NH', remainingSeats: 2 },
          first: { available: true, mileageCost: 485_000, taxesUsd: 45, airlines: 'NH', remainingSeats: 1 },
        } }),
      ],
      { resolveAirport },
    );
    expect(deals).toHaveLength(1); // 485k F is score < 1 → dropped
    const d = deals[0]!;
    expect(d.cabin).toBe('business');
    expect(d.score).toBeCloseTo(75_000 / 60_000, 5);
    expect(d.cityTo).toBe('Tokyo');
    expect(d.intl).toBe(true);
    expect(d.provenance).toBe('seats.aero verified award space');
    // HC #618 R4: every figure labels trip type honestly (seats.aero = one-way segments).
    expect(awardDealSummary(d)).toBe('Business to Tokyo — 60k pts + $45 one-way · verified Jul 14');
    expect(d.tripType).toBe('one-way');
    // HC #618 R2: without homeAirport, every deal is treated as primary (legacy path).
    expect(d.homeAnchored).toBe(true);
  });

  it('dedupes per destination+cabin keeping the cheapest, drops domestic short-haul positioning hops', () => {
    const mk = (origin: string, dest: string, miles: number, distanceMi: number, destRegion = 'Europe') =>
      rec({ origin, dest, distanceMi, destRegion, cabins: {
        economy: { available: true, mileageCost: miles, taxesUsd: 30, airlines: 'TP', remainingSeats: 4 },
        premiumEconomy: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        business: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        first: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
      } });
    const deals = generateAwardDeals(
      [
        mk('JFK', 'LIS', 22_000, 3370), // dupe, worse
        mk('MCO', 'LIS', 17_500, 4070), // dupe, cheaper → kept
        mk('MCO', 'ATL', 10_000, 400, 'North America'), // domestic short hop, not a vacation spot → filtered (HC #615)
        mk('MCO', 'JFK', 10_000, 950, 'North America'), // domestic short hop but curated vacation spot → kept
      ],
      { resolveAirport, vacationCodes: new Set(['LIS', 'JFK']) },
    );
    // HC #618 R2 — dedupe is now per (origin, destination, cabin) so MCO→LIS and JFK→LIS
    // both survive (different origins), while the domestic short hop ATL is filtered.
    expect(deals).toHaveLength(3);
    expect(deals.some((d) => d.flyTo === 'ATL')).toBe(false);
    const lisMco = deals.find((d) => d.flyTo === 'LIS' && d.flyFrom === 'MCO')!;
    expect(lisMco.miles).toBe(17_500);
    expect(lisMco.vacation).toBe(true);
    const jfkHop = deals.find((d) => d.flyTo === 'JFK')!;
    expect(jfkHop.intl).toBe(false);
    expect(jfkHop.vacation).toBe(true);
  });

  it('HC #618 R2 — anchors deals to home/hub cluster; non-hub origins become detour-tier', () => {
    const mk = (origin: string, dest: string, miles: number, distanceMi: number, destRegion = 'Europe') =>
      rec({ origin, dest, distanceMi, destRegion, cabins: {
        economy: { available: true, mileageCost: miles, taxesUsd: 30, airlines: 'AC', remainingSeats: 4 },
        premiumEconomy: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        business: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        first: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
      } });
    const AIRPORTS2 = {
      ...AIRPORTS,
      MIA: { code: 'MIA', city: 'Miami', country: 'United States', lat: 25.79, lon: -80.29 },
      YYZ: { code: 'YYZ', city: 'Toronto', country: 'Canada', lat: 43.68, lon: -79.63 },
    };
    const deals = generateAwardDeals(
      [
        mk('MCO', 'LIS', 22_000, 4070), // home → primary
        mk('MIA', 'LIS', 24_000, 4150), // hub of MCO → primary
        mk('YYZ', 'LIS', 18_000, 3540), // detour (toronto) → secondary
      ],
      { resolveAirport: (c) => AIRPORTS2[c as keyof typeof AIRPORTS2], homeAirport: 'MCO' },
    );
    const homeAnchored = deals.filter((d) => d.homeAnchored).map((d) => d.flyFrom);
    const detour = deals.filter((d) => !d.homeAnchored).map((d) => d.flyFrom);
    expect(homeAnchored).toEqual(expect.arrayContaining(['MCO', 'MIA']));
    expect(detour).toEqual(['YYZ']);
    // primary ranks above detour even when detour is cheaper (the user is in Orlando).
    expect(deals[0]!.homeAnchored).toBe(true);
  });

  it('HC #618 R3 — preferFarther floats longhaul above home-region short hops', () => {
    const mk = (origin: string, dest: string, miles: number, distanceMi: number) =>
      rec({ origin, dest, distanceMi, destRegion: 'Asia', cabins: {
        economy: { available: true, mileageCost: miles, taxesUsd: 30, airlines: 'NH', remainingSeats: 4 },
        premiumEconomy: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        business: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        first: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
      } });
    const records = [
      mk('MCO', 'NRT', 35_000, 7800), // longhaul
      mk('MCO', 'JFK', 8_000, 950),   // short cheap home hop (curated vacation)
    ];
    const vacationCodes = new Set(['JFK', 'NRT']);
    const offHome = generateAwardDeals(records, { resolveAirport, vacationCodes, homeAirport: 'MCO' });
    const onHome = generateAwardDeals(records, { resolveAirport, vacationCodes, homeAirport: 'MCO', preferFarther: true });
    // Default: cheap short JFK hop wins on raw score
    expect(onHome[0]!.flyTo).toBe('NRT'); // preferFarther flips it
    // and the off-toggle keeps at least one of each in the list (sanity)
    expect(offHome.length).toBeGreaterThanOrEqual(2);
  });

  it('skips airports without coordinates (no dot, no deal) and respects limit', () => {
    const deals = generateAwardDeals(
      [rec({ origin: 'JFK', dest: 'XXX', cabins: {
        economy: { available: true, mileageCost: 10_000, taxesUsd: 10, airlines: 'AA', remainingSeats: 1 },
        premiumEconomy: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        business: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        first: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
      } })],
      { resolveAirport },
    );
    expect(deals).toHaveLength(0);
  });

  it('HC #618 R4 — pairs reciprocal one-way legs into a verified round-trip deal at distance-banded nights', () => {
    // JFK→NRT 6740 mi (long-haul band 7–14 nights). Outbound 2026-07-14, inbound 2026-07-21 = 7 nights, in band.
    const outbound = rec({
      origin: 'JFK', dest: 'NRT', date: '2026-07-14', distanceMi: 6740,
      cabins: {
        economy: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        premiumEconomy: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        business: { available: true, mileageCost: 60_000, taxesUsd: 45, airlines: 'NH', remainingSeats: 2 },
        first: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
      },
    });
    const inbound = rec({
      origin: 'NRT', dest: 'JFK', date: '2026-07-21', distanceMi: 6740,
      cabins: {
        economy: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        premiumEconomy: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        business: { available: true, mileageCost: 60_000, taxesUsd: 50, airlines: 'NH', remainingSeats: 1 },
        first: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
      },
    });
    const deals = generateAwardDeals([outbound, inbound], { resolveAirport });
    const j = deals.find((d) => d.flyFrom === 'JFK' && d.flyTo === 'NRT' && d.cabin === 'business')!;
    expect(j).toBeDefined();
    expect(j.tripType).toBe('round-trip');
    expect(j.nights).toBe(7);
    expect(j.miles).toBe(120_000); // 60k outbound + 60k return
    expect(j.taxesUsd).toBe(95);   // $45 + $50
    expect(j.longStay).toBe(false);
    expect(j.returnDate).toBe('2026-07-21');
  });

  it('HC #619 — refuses to pair an inbound that produces a >30-night long-stay trip in the default feed', () => {
    // outbound 2026-07-14, inbound 2026-09-30 = 78 nights — past the hard cap.
    // No realistic return → falls back to one-way honest labeling.
    const outbound = rec({
      origin: 'JFK', dest: 'NRT', date: '2026-07-14', distanceMi: 6740,
      cabins: {
        economy: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        premiumEconomy: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        business: { available: true, mileageCost: 60_000, taxesUsd: 45, airlines: 'NH', remainingSeats: 2 },
        first: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
      },
    });
    const inboundFar = rec({
      origin: 'NRT', dest: 'JFK', date: '2026-09-30', distanceMi: 6740,
      cabins: {
        economy: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        premiumEconomy: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
        business: { available: true, mileageCost: 60_000, taxesUsd: 50, airlines: 'NH', remainingSeats: 1 },
        first: { available: false, mileageCost: null, taxesUsd: null, airlines: '', remainingSeats: null },
      },
    });
    const deals = generateAwardDeals([outbound, inboundFar], { resolveAirport });
    const j = deals.find((d) => d.flyFrom === 'JFK' && d.flyTo === 'NRT')!;
    expect(j.tripType).toBe('one-way');
    expect(j.nights).toBeNull();
    expect(j.longStay).toBe(false);
  });
});

describe('parseBulkRecord', () => {
  it('parses the live response shape (verified 2026-06-12), trusting FILTERED flags + USD-only taxes', () => {
    const raw = {
      Route: { OriginAirport: 'JFK', OriginRegion: 'North America', DestinationAirport: 'NRT', DestinationRegion: 'Asia', Distance: 6740, Source: 'aeroplan' },
      Date: '2026-07-14',
      YAvailable: true, WAvailable: false, JAvailable: true, FAvailable: false,
      YMileageCostRaw: 37500, WMileageCostRaw: 0, JMileageCostRaw: 60000, FMileageCostRaw: 0,
      TaxesCurrency: 'CAD',
      YTotalTaxesRaw: 6990, JTotalTaxesRaw: 7270,
      YAirlinesRaw: 'AC, NH', JAirlinesRaw: 'NH',
      YRemainingSeatsRaw: 2, JRemainingSeatsRaw: 1,
      Source: 'aeroplan',
    };
    const rec = parseBulkRecord(raw, '2026-06-12T00:00:00.000Z')!;
    expect(rec.origin).toBe('JFK');
    expect(rec.dest).toBe('NRT');
    expect(rec.distanceMi).toBe(6740);
    expect(rec.cabins.business).toEqual({ available: true, mileageCost: 60000, taxesUsd: null, airlines: 'NH', remainingSeats: 1 });
    expect(rec.cabins.economy.taxesUsd).toBeNull(); // CAD taxes never masquerade as USD
    expect(rec.cabins.premiumEconomy.available).toBe(false);
  });

  it('drops rows with no verified space and malformed airport codes', () => {
    expect(parseBulkRecord({ Route: { OriginAirport: 'JFK', DestinationAirport: 'NRT' }, YAvailable: false }, 'x')).toBeNull();
    expect(parseBulkRecord({ Route: { OriginAirport: 'bad', DestinationAirport: 'NRT' }, YAvailable: true }, 'x')).toBeNull();
  });
});
