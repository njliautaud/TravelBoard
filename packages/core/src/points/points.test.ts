/**
 * Points-transfer game unit tests (HC #602).
 *  - knowledge-graph integrity (the dataset update path's safety net)
 *  - Frequent Miler bonus-table parser (fixture from real 2026-06 markup)
 *  - SourceRunner TTL / retry / stale-grace / unconfigured behavior
 *  - valuation math incl. transfer-bonus application
 */

import { describe, it, expect } from 'vitest';
import {
  PROGRAMS,
  TRANSFER_EDGES,
  CARD_CATALOG,
  AWARD_CHARTS,
  PARTNER_BY_ID,
  PROGRAM_BY_ID,
} from './data/transfer-partners.js';
import { parseFrequentMilerBonuses, parseFmDate } from './sources/frequentmiler-bonuses.js';
import { SourceRunner } from './sources/adapter.js';
import { summarizeVerifiedAwards, type AwardAvailability } from './sources/seats-aero.js';
import { valuateDeal, estimateAwardMiles, transferablePrograms } from './valuation.js';
import type { PointsSourceAdapter, TransferBonus } from './types.js';

// ---------------------------------------------------------------------------
describe('transfer-partner knowledge graph integrity', () => {
  it('has all six major ecosystems', () => {
    const ids = PROGRAMS.map((p) => p.id).sort();
    expect(ids).toEqual(['amex_mr', 'bilt', 'cap1_miles', 'chase_ur', 'citi_typ', 'wf_rewards']);
  });

  it('every edge references an existing program and partner with a sane ratio', () => {
    for (const e of TRANSFER_EDGES) {
      expect(PROGRAM_BY_ID.has(e.program), `program ${e.program}`).toBe(true);
      expect(PARTNER_BY_ID.has(e.partner), `partner ${e.partner}`).toBe(true);
      expect(e.ratio).toBeGreaterThan(0);
      expect(e.ratio).toBeLessThanOrEqual(2);
    }
  });

  it('every program has at least 5 airline partners', () => {
    for (const p of PROGRAMS) {
      const airlines = TRANSFER_EDGES.filter(
        (e) => e.program === p.id && PARTNER_BY_ID.get(e.partner)?.kind === 'airline',
      );
      expect(airlines.length, p.id).toBeGreaterThanOrEqual(5);
    }
  });

  it('every card maps to a real program; no duplicate card ids', () => {
    const seen = new Set<string>();
    for (const c of CARD_CATALOG) {
      expect(PROGRAM_BY_ID.has(c.program), c.id).toBe(true);
      expect(seen.has(c.id), c.id).toBe(false);
      seen.add(c.id);
    }
    // every ecosystem has at least one transfer-ENABLED card
    for (const p of PROGRAMS) {
      expect(CARD_CATALOG.some((c) => c.program === p.id && c.transferEnabled), p.id).toBe(true);
    }
  });

  it('award charts have monotonically increasing bands and reference real partners', () => {
    for (const c of AWARD_CHARTS) {
      expect(PARTNER_BY_ID.has(c.partner), c.partner).toBe(true);
      let prevMax = 0;
      let prevMiles = 0;
      for (const b of c.bands) {
        expect(b.maxMiles).toBeGreaterThan(prevMax);
        expect(b.oneWayMiles).toBeGreaterThanOrEqual(prevMiles);
        prevMax = b.maxMiles;
        prevMiles = b.oneWayMiles;
      }
    }
  });
});

// ---------------------------------------------------------------------------
describe('Frequent Miler bonus parser', () => {
  // real markup shape captured 2026-06-11 (TablePress: sort-key prefix glued to dates)
  const FIXTURE = `
  <table><thead><tr><th>Transfer From</th><th>Transfer Bonus Details</th><th>Start Date</th><th>End Date</th></tr></thead>
  <tbody>
  <tr><td>Chase Ultimate Rewards</td><td>30% transfer bonus from Chase Ultimate Rewards to Virgin Atlantic Flying Club</td><td><span>46182</span>06/09/26</td><td><span>46217</span>07/14/26</td></tr>
  <tr><td>Amex Membership Rewards</td><td>25% transfer bonus from Amex Membership Rewards to Air France KLM Flying Blue</td><td>4617506/02/26</td><td>4620306/30/26</td></tr>
  <tr><td>Citi ThankYou Rewards</td><td>30% transfer bonus from Citi ThankYou Rewards to Qatar Privilege Club Avios</td><td>4617406/01/26</td><td>4620306/30/26</td></tr>
  <tr><td>Rove Miles</td><td>50% transfer bonus from Rove Miles to Turkish Airlines Miles &amp; Smiles</td><td>4617406/01/26</td><td>4620306/30/26</td></tr>
  <tr><td>Amex Membership Rewards</td><td>20% transfer bonus from Amex Membership Rewards to Marriott Bonvoy</td><td>4617406/01/26</td><td>4620306/30/26</td></tr>
  <tr><td>Chase Ultimate Rewards</td><td>40% transfer bonus from Chase Ultimate Rewards to British Airways Avios</td><td>4400001/01/25</td><td>4403002/01/25</td></tr>
  </tbody></table>`;

  const NOW = new Date('2026-06-11T12:00:00Z');

  it('parses active bonuses for our ecosystems and drops the rest', () => {
    const bonuses = parseFrequentMilerBonuses(FIXTURE, NOW);
    const keys = bonuses.map((b) => `${b.program}->${b.partner}@${b.bonus}`).sort();
    expect(keys).toEqual([
      'amex_mr->flying_blue@0.25',
      'amex_mr->marriott@0.2',
      'chase_ur->virgin_atlantic@0.3',
      'citi_typ->qatar_avios@0.3',
    ]);
    // Rove Miles row excluded (not one of our six); expired BA row excluded
  });

  it('parses dates through the TablePress sort-key prefix', () => {
    expect(parseFmDate('4617406/01/26')).toBe('2026-06-01');
    expect(parseFmDate('06/30/26')).toBe('2026-06-30');
    expect(parseFmDate('garbage')).toBeNull();
    const b = parseFrequentMilerBonuses(FIXTURE, NOW).find((x) => x.partner === 'virgin_atlantic')!;
    expect(b.startDate).toBe('2026-06-09');
    expect(b.endDate).toBe('2026-07-14');
  });
});

// ---------------------------------------------------------------------------
describe('SourceRunner', () => {
  function makeAdapter(behavior: { fail?: boolean; payload?: string[] }): PointsSourceAdapter<string[]> & { calls: number } {
    const a = {
      id: 'test-src',
      kind: 'json-api' as const,
      calls: 0,
      async fetch() {
        a.calls++;
        if (behavior.fail) throw new Error('boom');
        return behavior.payload ?? ['x'];
      },
    };
    return a;
  }

  it('serves from TTL cache without refetching', async () => {
    const a = makeAdapter({ payload: ['fresh'] });
    const r = new SourceRunner(a, { ttlMs: 60_000 });
    const first = await r.get();
    const second = await r.get();
    expect(first.data).toEqual(['fresh']);
    expect(second.health.status).toBe('ok');
    expect(a.calls).toBe(1);
  });

  it('degrades to STALE (not blank) when the source dies after a success', async () => {
    const a = makeAdapter({ payload: ['old-data'] });
    const r = new SourceRunner(a, { ttlMs: 5, retries: 0, backoffMs: 1 });
    await r.get(); // success
    (a as { fetch: () => Promise<string[]> }).fetch = async () => { a.calls++; throw new Error('down'); };
    await new Promise((res) => setTimeout(res, 15)); // pass TTL
    const after = await r.get();
    expect(after.data).toEqual(['old-data']); // stale-grace: keep serving
    expect(after.health.status).toBe('stale');
    expect(after.health.lastError).toBe('down');
  });

  it('reports unavailable (data null) when it never succeeded', async () => {
    const a = makeAdapter({ fail: true });
    const r = new SourceRunner(a, { ttlMs: 1000, retries: 1, backoffMs: 1 });
    const res = await r.get();
    expect(res.data).toBeNull();
    expect(res.health.status).toBe('unavailable');
    expect(a.calls).toBe(2); // initial + 1 retry
  });

  it('reports unconfigured and never fetches when the adapter lacks its key', async () => {
    const a = makeAdapter({ payload: ['nope'] });
    (a as PointsSourceAdapter<string[]>).configured = () => false;
    const r = new SourceRunner(a, { ttlMs: 1000 });
    const res = await r.get();
    expect(res.data).toBeNull();
    expect(res.health.status).toBe('unconfigured');
    expect(a.calls).toBe(0);
  });

  // HC #604 — disk persistence: pre-seed from persist.load, save after every success.
  it('HC604: pre-seeds from persistence and serves without refetching while fresh', async () => {
    const a = makeAdapter({ payload: ['network'] });
    const r = new SourceRunner(a, {
      ttlMs: 60_000,
      persist: {
        load: () => ({ data: ['from-disk'], fetchedAt: new Date().toISOString() }),
        save: () => {},
      },
    });
    const res = await r.get();
    expect(res.data).toEqual(['from-disk']);
    expect(res.health.status).toBe('ok');
    expect(a.calls).toBe(0); // restart survival: no cold refetch needed
  });

  it('HC604: persisted data older than TTL is served honestly as STALE while a refetch fails', async () => {
    const a = makeAdapter({ fail: true });
    const old = new Date(Date.now() - 10 * 60_000).toISOString();
    const r = new SourceRunner(a, {
      ttlMs: 60_000,
      staleGraceMs: 60 * 60_000,
      retries: 0,
      backoffMs: 1,
      persist: { load: () => ({ data: ['old-disk'], fetchedAt: old }), save: () => {} },
    });
    const res = await r.get();
    expect(res.data).toEqual(['old-disk']);
    expect(res.health.status).toBe('stale');
    expect(a.calls).toBe(1); // it DID try to refresh
  });

  it('HC604: saves after every successful refresh; a throwing load() is swallowed', async () => {
    const saved: Array<{ data: string[]; at: string }> = [];
    const a = makeAdapter({ payload: ['fresh'] });
    const r = new SourceRunner(a, {
      ttlMs: 60_000,
      persist: {
        load: () => { throw new Error('corrupt cache row'); }, // must be swallowed
        save: (data, at) => { saved.push({ data, at }); },
      },
    });
    const res = await r.get();
    expect(res.data).toEqual(['fresh']);
    expect(res.health.status).toBe('ok');
    expect(saved).toHaveLength(1);
    expect(saved[0]!.data).toEqual(['fresh']);
    expect(Number.isFinite(Date.parse(saved[0]!.at))).toBe(true);
  });

  it('HC604: a throwing save() does not break a good fetch', async () => {
    const a = makeAdapter({ payload: ['ok'] });
    const r = new SourceRunner(a, {
      ttlMs: 60_000,
      persist: { load: () => null, save: () => { throw new Error('disk full'); } },
    });
    const res = await r.get();
    expect(res.data).toEqual(['ok']);
    expect(res.health.status).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
describe('valuation engine', () => {
  const HELD = [
    { cardId: 'chase_sapphire_preferred', held: true },
    { cardId: 'amex_gold', held: true },
    { cardId: 'chase_freedom_flex', held: true }, // earns UR but cannot transfer
  ];

  it('derives transferable programs from held cards only', () => {
    expect(transferablePrograms(HELD).sort()).toEqual(['amex_mr', 'chase_ur']);
    expect(transferablePrograms([{ cardId: 'chase_freedom_flex', held: true }])).toEqual([]);
  });

  it('estimates Avios short-haul from the published distance chart', () => {
    const est = estimateAwardMiles('ba_avios', 600)!; // <650mi band
    expect(est.miles).toBe(12_000); // 6k each way
    expect(est.quality).toBe('chart');
  });

  it('applies an active transfer bonus and reduces points needed', () => {
    const bonuses: TransferBonus[] = [{
      program: 'chase_ur',
      partner: 'virgin_atlantic',
      bonus: 0.3,
      endDate: '2026-07-14',
      description: '30% transfer bonus',
      source: 'test',
      fetchedAt: new Date().toISOString(),
    }];
    const noBonus = valuateDeal({ flyTo: 'LHR', cashPrice: 900, distanceMiles: 4300, held: HELD, bonuses: [] });
    const withBonus = valuateDeal({ flyTo: 'LHR', cashPrice: 900, distanceMiles: 4300, held: HELD, bonuses });
    const vsPlain = noBonus.paths.find((p) => p.partner === 'virgin_atlantic')!;
    const vsBoosted = withBonus.paths.find((p) => p.partner === 'virgin_atlantic')!;
    expect(vsBoosted.programPointsNeeded).toBeLessThan(vsPlain.programPointsNeeded);
    expect(vsBoosted.bonus).toBe(0.3);
    expect(vsBoosted.cpp).toBeGreaterThan(vsPlain.cpp);
    expect(vsBoosted.verdict).toContain('30% bonus');
  });

  it('valuation is honest: availability unverified by default, no best path when cpp is poor', () => {
    const v = valuateDeal({ flyTo: 'XXX', cashPrice: 60, distanceMiles: 4300, held: HELD, bonuses: [] });
    expect(v.availabilityVerified).toBe(false);
    expect(v.best).toBeNull(); // $60 long-haul fare — points would be a rip-off; pay cash
  });

  it('finds a strong points play on an expensive route', () => {
    const v = valuateDeal({ flyTo: 'LHR', cashPrice: 1840, distanceMiles: 4300, held: HELD, bonuses: [] });
    expect(v.best).not.toBeNull();
    expect(v.best!.cpp).toBeGreaterThanOrEqual(1.3);
    expect(v.best!.verdict).toMatch(/cpp/);
    expect(v.paths.length).toBeGreaterThan(1);
    // held cards without transferable programs produce nothing
    const none = valuateDeal({ flyTo: 'LHR', cashPrice: 1840, distanceMiles: 4300, held: [], bonuses: [] });
    expect(none.paths).toEqual([]);
    expect(none.best).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// HC #607 — seats.aero verified-award rollup (Pro key live)
// ---------------------------------------------------------------------------
describe('summarizeVerifiedAwards (seats.aero)', () => {
  const base = {
    economyTaxesUsd: 5.6, economyAirlines: 'AA', economyRemainingSeats: 4,
    businessAvailable: false, businessMileageCost: null, businessTaxesUsd: null,
    businessAirlines: '', businessRemainingSeats: null,
    fetchedAt: '2026-06-11T20:00:00.000Z',
  };
  const rec = (over: Partial<AwardAvailability>): AwardAvailability => ({
    route: 'MCO-LHR', source: 'american', date: '2026-07-01',
    economyAvailable: true, economyMileageCost: 30000, ...base, ...over,
  });

  it('picks the cheapest verified cabin per destination with binding provenance', () => {
    const out = summarizeVerifiedAwards([
      rec({}),
      rec({ source: 'qantas', economyMileageCost: 29000, date: '2026-07-03' }),
      rec({ route: 'MCO-NRT', economyAvailable: false, economyMileageCost: null,
        businessAvailable: true, businessMileageCost: 57500, businessAirlines: 'AA, BA' }),
    ]);
    const lhr = out['LHR']!;
    expect(lhr.provenance).toBe('verified award space'); // honesty label: award space, never cash fares
    expect(lhr.provider).toBe('seats.aero');
    expect(lhr.economy!.miles).toBe(29000);
    expect(lhr.economy!.programName).toBe('Qantas Frequent Flyer');
    expect(lhr.daysWithSpace).toBe(2);
    expect(lhr.programs.sort()).toEqual(['american', 'qantas']);
    // business-only destination: economy honestly null
    expect(out['NRT']!.economy).toBeNull();
    expect(out['NRT']!.business!.miles).toBe(57500);
  });

  it('emits NO entry when there is no verified space (honest absence, estimates fallback)', () => {
    const out = summarizeVerifiedAwards([
      rec({ economyAvailable: false, economyMileageCost: null }),
    ]);
    expect(out['LHR']).toBeUndefined();
    expect(summarizeVerifiedAwards([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// HC #608 — premium cabins (W/J/F) + verified-award cpp valuation
// ---------------------------------------------------------------------------
import { valuateVerifiedCabin, CABIN_FARE_MULTIPLIERS } from './valuation.js';
import type { VerifiedCabinAward } from './sources/seats-aero.js';

describe('summarizeVerifiedAwards premium cabins (HC #608)', () => {
  it('rolls up premium-economy and first space, and tolerates pre-HC608 cached records', () => {
    const out = summarizeVerifiedAwards([
      {
        route: 'MCO-LHR', source: 'virginatlantic', date: '2026-07-05',
        economyAvailable: false, economyMileageCost: null, economyTaxesUsd: null, economyAirlines: '', economyRemainingSeats: null,
        premiumEconomyAvailable: true, premiumEconomyMileageCost: 35000, premiumEconomyTaxesUsd: 120, premiumEconomyAirlines: 'VS', premiumEconomyRemainingSeats: 2,
        businessAvailable: false, businessMileageCost: null, businessTaxesUsd: null, businessAirlines: '', businessRemainingSeats: null,
        firstAvailable: true, firstMileageCost: 95000, firstTaxesUsd: 200, firstAirlines: 'BA', firstRemainingSeats: 1,
        fetchedAt: '2026-06-11T20:00:00.000Z',
      },
      // pre-HC608 cached record: NO W/F fields at all — must not crash, Y still counts
      {
        route: 'MCO-LHR', source: 'american', date: '2026-07-06',
        economyAvailable: true, economyMileageCost: 30000, economyTaxesUsd: 5.6, economyAirlines: 'AA', economyRemainingSeats: 4,
        businessAvailable: false, businessMileageCost: null, businessTaxesUsd: null, businessAirlines: '', businessRemainingSeats: null,
        fetchedAt: '2026-06-11T20:00:00.000Z',
      },
    ]);
    const lhr = out['LHR']!;
    expect(lhr.premiumEconomy!.miles).toBe(35000);
    expect(lhr.premiumEconomy!.cabin).toBe('premiumEconomy');
    expect(lhr.first!.miles).toBe(95000);
    expect(lhr.first!.programName).toBe('Virgin Atlantic Flying Club');
    expect(lhr.economy!.miles).toBe(30000);
    expect(lhr.business).toBeNull();
    expect(lhr.daysWithSpace).toBe(2);
  });
});

describe('valuateVerifiedCabin (HC #608 — premium-cabin valuation un-deferred)', () => {
  const held = [{ cardId: 'chase_sapphire_preferred', held: true }];
  const cabinAward = (over: Partial<VerifiedCabinAward>): VerifiedCabinAward => ({
    cabin: 'business', miles: 70000, taxesUsd: 60, program: 'aeroplan',
    programName: 'Air Canada Aeroplan', airlines: 'AC', date: '2026-07-01', remainingSeats: 2,
    ...over,
  });

  it('business cpp uses the MODELED fare benchmark, honestly labeled', () => {
    const v = valuateVerifiedCabin({ award: cabinAward({}), cashPriceEconomyRt: 1000, held, bonuses: [] })!;
    expect(v.fareBasis).toBe('modeled');
    expect(v.refFareUsd).toBe(1000 * CABIN_FARE_MULTIPLIERS.business);
    expect(v.programPointsNeeded).toBe(140000); // 2× one-way miles, 1:1, 1k blocks
    expect(v.cpp).toBeCloseTo(((3000 - 120) * 100) / 140000, 2);
    expect(v.program).toBe('chase_ur');
    expect(v.partner).toBe('aeroplan');
    expect(v.verdict).toContain('modeled');
    expect(v.verdict).toContain('VERIFIED business award space');
  });

  it('economy cpp uses the REAL cash quote (fareBasis cash)', () => {
    const v = valuateVerifiedCabin({
      award: cabinAward({ cabin: 'economy', miles: 29000, taxesUsd: 5.6 }),
      cashPriceEconomyRt: 1000, held, bonuses: [],
    })!;
    expect(v.fareBasis).toBe('cash');
    expect(v.refFareUsd).toBe(1000);
    expect(v.programPointsNeeded).toBe(58000);
    expect(v.cpp).toBeCloseTo(((1000 - 11.2) * 100) / 58000, 2);
  });

  it('applies an active transfer bonus to the points needed', () => {
    const v = valuateVerifiedCabin({
      award: cabinAward({}), cashPriceEconomyRt: 1000, held,
      bonuses: [{ program: 'chase_ur', partner: 'aeroplan', bonus: 0.3, description: 't', source: 't', fetchedAt: 't' }],
    })!;
    expect(v.bonus).toBe(0.3);
    expect(v.programPointsNeeded).toBe(108000); // ceil(140000/1.3/1000)*1000
  });

  it('returns null honestly: unmapped program, or no held transfer path', () => {
    expect(valuateVerifiedCabin({ award: cabinAward({ program: 'smiles' }), cashPriceEconomyRt: 1000, held, bonuses: [] })).toBeNull();
    expect(valuateVerifiedCabin({ award: cabinAward({}), cashPriceEconomyRt: 1000, held: [], bonuses: [] })).toBeNull();
    expect(valuateVerifiedCabin({ award: cabinAward({}), cashPriceEconomyRt: 0, held, bonuses: [] })).toBeNull();
  });
});
