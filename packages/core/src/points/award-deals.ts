/**
 * HC #617/#618 — turn bulk seats.aero verified award availability into DEALS,
 * anchored to the user's HOME airport or its nearest major hub cluster.
 *
 * HC #618 R2 — owner's verbatim complaint: "showing me deals from toronto when
 *   im in orlando is cool sure ... most trips should be from their airport or
 *   the CLOSEST MAIN ONE. like MIA for orlando."
 *
 * The pure deal-generation pass: BulkAwardRecord[] in → ranked AwardDeal[] out.
 *
 * WHAT COUNTS AS A DEAL (documented, auditable):
 *   A cabin award is a deal when its one-way mileage cost is AT OR BELOW a
 *   distance-banded benchmark (rough industry award-chart medians). score =
 *   benchmark / miles, so 1.0 = par, 1.5 = 50% cheaper than typical. Junk
 *   dynamic pricing (e.g. 485k-mile J) self-eliminates: score < 1 → dropped.
 *
 * ANCHOR RULE (R2):
 *   - PRIMARY deals depart the home airport OR a hub in its cluster
 *     (HUB_CLUSTERS — e.g. MCO → MIA/FLL/TPA). Headline surfaces (wall strip,
 *     map highlight) only show primary deals.
 *   - DETOUR deals depart any other origin. They are kept so adventurous users
 *     can still see them, but labeled "from nearby hubs / worth a detour" and
 *     capped so they never crowd out the home-anchored feed.
 *
 * RANKING:
 *   - score, boosted for international destinations (+0.20), curated vacation
 *     spots (+0.10) and long-haul premium cabins (+0.10) — owner asked for
 *     "real vacations", not positioning hops.
 *   - HC #618 R3 — when `preferFarther` is on, longhaul (>3000mi) gets +0.30
 *     and intercontinental international stays boosted; near-home cheap hops
 *     sink. Off by default — opt-in only.
 *
 * DEDUP: one deal per (origin, destination, cabin); the cheapest miles wins.
 *
 * HONESTY: every deal carries provenance 'seats.aero verified award space',
 *   the date the space was actually seen, and tripType = 'one-way' (seats.aero
 *   returns one-way segments — labeling is honest, never fake round-trips).
 */

import type { BulkAwardRecord } from './sources/seats-aero-bulk';
import { SEATS_PROGRAM_NAMES, CABIN_LABELS, type Cabin } from './sources/seats-aero';
import { hubsForHome } from '../data/hubs';
import {
  durationBandForDistance,
  LONG_STAY_THRESHOLD_NIGHTS,
  nightsBetween,
} from '../fares/duration-bands';

export interface AwardDeal {
  /** stable id: ORIGIN-DEST-cabin */
  id: string;
  flyFrom: string;
  originCity: string;
  flyTo: string;
  cityTo: string;
  countryTo: string;
  lat: number;
  lon: number;
  cabin: Cabin;
  cabinLabel: string;
  /** one-way partner miles (verified) */
  miles: number;
  taxesUsd: number | null;
  program: string;
  programName: string;
  airlines: string;
  /** yyyy-mm-dd the verified space was seen for */
  date: string;
  seatsLeft: number | null;
  distanceMi: number;
  /** benchmark/actual — 1.0 = par with typical award pricing, higher = better */
  score: number;
  /** destination is outside the origin's country (a "real vacation" signal) */
  intl: boolean;
  /** destination is on the curated worldwide vacation list */
  vacation: boolean;
  /**
   * HC #618 R2 — true when the deal departs the user's home airport OR a
   * hub in its cluster. False = detour / "worth a detour" section.
   */
  homeAnchored: boolean;
  /**
   * HC #618 R4 — every figure on a card must label one-way vs round-trip.
   * seats.aero returns one-way segments; we pair reciprocal outbound+inbound
   * dates into round-trips at distance-banded realistic nights (HC #619) when
   * the data supports it, otherwise we honestly label as one-way.
   */
  tripType: 'one-way' | 'round-trip';
  /**
   * HC #619 R4 — nights between depart and return when this deal is paired
   * round-trip. null on one-way deals. Surfaced on the card so the user always
   * sees the trip length.
   */
  nights: number | null;
  /**
   * HC #619 R4 — true when nights > the consumer hard cap (~30). Cards with
   * this flag get a "long stay" badge AND are excluded from the default feed
   * (only shown when the user opts in). Always false for one-way deals.
   */
  longStay: boolean;
  /** yyyy-mm-dd of the verified RETURN flight when paired round-trip; null on one-way. */
  returnDate: string | null;
  provenance: 'seats.aero verified award space';
  fetchedAt: string;
}

export interface AirportInfo {
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export interface GenerateAwardDealsOptions {
  /** coordinate/city resolver (core findAirport) — unresolvable airports are skipped */
  resolveAirport: (code: string) => AirportInfo | undefined;
  /** curated vacation destination codes (VACATION_SPOTS) */
  vacationCodes?: ReadonlySet<string>;
  /** max deals returned (after per-origin+dest+cabin dedupe) */
  limit?: number;
  /**
   * HC #618 R2 — user's home airport IATA. When provided, deals whose origin
   * is the home or any hub in its cluster are flagged homeAnchored and ranked
   * above detour deals. Without it (legacy callers), every deal is "primary".
   */
  homeAirport?: string;
  /**
   * HC #618 R3 — opt-in: weight intl + longhaul above near-home cheap hops.
   * Defaults to false (most users want home-anchored short-haul first).
   */
  preferFarther?: boolean;
  /**
   * HC #618 R2 — separately cap the detour ("from nearby hubs / worth a
   * detour") tail so it never crowds out the home-anchored feed. Default 30.
   */
  detourCap?: number;
  /**
   * HC #619 R1 — opt-in: surface trips > LONG_STAY_THRESHOLD_NIGHTS (30 nights).
   * Default false: long-stay deals are excluded from the default feed so the
   * board never headlines a 60-night "deal". When true, long-stay deals are
   * included but always tagged longStay so the UI can badge them.
   */
  includeLongStay?: boolean;
}

/** Distance-banded one-way mileage benchmarks (rough award-chart medians). */
export function benchmarkMiles(cabin: Cabin, distanceMi: number): number {
  const d = distanceMi;
  const economy = d < 1500 ? 12_500 : d < 3000 ? 17_500 : d < 5000 ? 30_000 : d < 7500 ? 40_000 : 45_000;
  switch (cabin) {
    case 'economy':
      return economy;
    case 'premiumEconomy':
      return Math.round(economy * 1.6);
    case 'business':
      return d < 1500 ? 25_000 : d < 3000 ? 35_000 : d < 5000 ? 60_000 : d < 7500 ? 75_000 : 85_000;
    case 'first':
      return Math.round((d < 1500 ? 25_000 : d < 3000 ? 35_000 : d < 5000 ? 60_000 : d < 7500 ? 75_000 : 85_000) * 1.5);
  }
}

const CABINS_ORDER: Cabin[] = ['economy', 'premiumEconomy', 'business', 'first'];

export function generateAwardDeals(records: BulkAwardRecord[], opts: GenerateAwardDealsOptions): AwardDeal[] {
  const {
    resolveAirport,
    vacationCodes,
    limit = 200,
    homeAirport,
    preferFarther = false,
    detourCap = 30,
    includeLongStay = false,
  } = opts;
  const home = homeAirport ? homeAirport.toUpperCase() : null;
  const hubSet = home ? new Set(hubsForHome(home)) : null;

  // HC #618 R4 / HC #619 — index reciprocal records (dest→origin same cabin)
  // so we can pair outbound+inbound legs into honest round-trips. Key is
  // `originCode:destCode:cabin`; value is the list of {date, miles, taxes} for
  // that direction. Realistic pairing: return date ∈ [outbound + bandMin,
  // outbound + bandMax] nights, with hard cap LONG_STAY_THRESHOLD_NIGHTS.
  type LegIndex = Map<string, Array<{ date: string; miles: number; taxes: number | null; airlines: string }>>;
  const legIndex: LegIndex = new Map();
  for (const r of records) {
    if (!(r.distanceMi > 0)) continue;
    for (const cabin of CABINS_ORDER) {
      const c = r.cabins[cabin];
      if (!c.available || c.mileageCost == null || c.mileageCost <= 0) continue;
      const key = `${r.source}|${r.origin}|${r.dest}|${cabin}`;
      const arr = legIndex.get(key) ?? [];
      arr.push({ date: r.date, miles: c.mileageCost, taxes: c.taxesUsd, airlines: c.airlines });
      legIndex.set(key, arr);
    }
  }

  /**
   * Find the cheapest realistic inbound leg for an outbound. Returns null if no
   * matching reciprocal exists in the verified bulk set. Realistic = within the
   * distance-banded nights window AND ≤ LONG_STAY_THRESHOLD_NIGHTS.
   */
  function findReturnLeg(
    source: string,
    outboundOrigin: string,
    outboundDest: string,
    cabin: Cabin,
    outboundDate: string,
    distanceMi: number,
  ): { date: string; miles: number; taxes: number | null } | null {
    const reciprocalKey = `${source}|${outboundDest}|${outboundOrigin}|${cabin}`;
    const candidates = legIndex.get(reciprocalKey);
    if (!candidates?.length) return null;
    const band = durationBandForDistance(distanceMi);
    let best: { date: string; miles: number; taxes: number | null } | null = null;
    for (const c of candidates) {
      const n = nightsBetween(outboundDate, c.date);
      if (n == null) continue;
      if (n < band.minNights || n > band.maxNights) continue;
      if (n > LONG_STAY_THRESHOLD_NIGHTS) continue; // hard cap
      if (!best || c.miles < best.miles || (c.miles === best.miles && c.date < best.date)) {
        best = { date: c.date, miles: c.miles, taxes: c.taxes };
      }
    }
    return best;
  }

  // best candidate per origin+destination+cabin (keep both home + detour for the
  // same dest/cabin so the wall + the "worth a detour" tail can coexist).
  const best = new Map<string, AwardDeal>();

  for (const r of records) {
    if (!(r.distanceMi > 0)) continue;
    const destInfo = resolveAirport(r.dest);
    if (!destInfo) continue; // no coords → can't be a map dot; skip honestly
    const originInfo = resolveAirport(r.origin);
    // HC #615/#617 — the owner wants REAL VACATIONS, not regional positioning
    // hops. Domestic short-haul only qualifies when it's a curated vacation
    // spot; international and 1500mi+ routes always get considered.
    const intlRoute = originInfo != null && originInfo.country !== destInfo.country;
    if (!intlRoute && r.distanceMi < 1500 && !(vacationCodes?.has(r.dest) ?? false)) continue;

    const homeAnchored = hubSet ? hubSet.has(r.origin) : true;

    for (const cabin of CABINS_ORDER) {
      const c = r.cabins[cabin];
      if (!c.available || c.mileageCost == null || c.mileageCost <= 0) continue;
      const bench = benchmarkMiles(cabin, r.distanceMi);
      const score = bench / c.mileageCost;
      if (score < 1) continue; // at-or-below benchmark only — par or better is a deal

      // HC #618 R4 — try to pair this outbound with a verified return at a
      // distance-banded realistic nights window (HC #619). If found, this deal
      // becomes a round-trip: miles = sum of legs, taxes = sum of taxes.
      const ret = findReturnLeg(r.source, r.origin, r.dest, cabin, r.date, r.distanceMi);
      const pairedMiles = ret ? c.mileageCost + ret.miles : c.mileageCost;
      const pairedTaxes = ret
        ? (c.taxesUsd ?? 0) + (ret.taxes ?? 0)
        : c.taxesUsd;
      const nights = ret ? nightsBetween(r.date, ret.date) : null;
      const longStay = nights != null && nights > LONG_STAY_THRESHOLD_NIGHTS;
      // Re-score using the round-trip benchmark when paired (RT benchmark = 2x
      // the one-way benchmark for the same distance/cabin).
      const pairedScore = ret ? (bench * 2) / pairedMiles : score;
      if (ret && pairedScore < 1) continue; // RT pair only kept when par-or-better

      const deal: AwardDeal = {
        id: `${r.origin}-${r.dest}-${cabin}`,
        flyFrom: r.origin,
        originCity: originInfo?.city ?? r.origin,
        flyTo: r.dest,
        cityTo: destInfo.city,
        countryTo: destInfo.country,
        lat: destInfo.lat,
        lon: destInfo.lon,
        cabin,
        cabinLabel: CABIN_LABELS[cabin],
        miles: pairedMiles,
        taxesUsd: pairedTaxes,
        program: r.source,
        programName: SEATS_PROGRAM_NAMES[r.source] ?? r.source,
        airlines: c.airlines,
        date: r.date,
        seatsLeft: c.remainingSeats,
        distanceMi: r.distanceMi,
        score: pairedScore,
        intl: originInfo != null && originInfo.country !== destInfo.country,
        vacation: vacationCodes?.has(r.dest) ?? false,
        homeAnchored,
        tripType: ret ? 'round-trip' : 'one-way',
        nights,
        longStay,
        returnDate: ret?.date ?? null,
        provenance: 'seats.aero verified award space',
        fetchedAt: r.fetchedAt,
      };

      // keep the best per origin+dest+cabin: cheaper miles wins; date tiebreak (sooner first)
      const key = `${r.origin}:${r.dest}:${cabin}`;
      const cur = best.get(key);
      if (!cur || deal.miles < cur.miles || (deal.miles === cur.miles && deal.date < cur.date)) {
        best.set(key, deal);
      }
    }
  }

  let all = [...best.values()];
  // HC #619 R1 — exclude long-stay deals from the default feed (opt-in only).
  if (!includeLongStay) {
    all = all.filter((d) => !d.longStay);
  }
  // Split primary (home-anchored) from detour so we can cap them independently
  // — owner asked for the headline to be home-origin, with a small "worth a
  // detour" tail. No anchor configured → everything is primary.
  const primary = all.filter((d) => d.homeAnchored);
  const detour = all.filter((d) => !d.homeAnchored);

  const rank = (d: AwardDeal) => rankScore(d, { preferFarther });
  primary.sort((a, b) => rank(b) - rank(a));
  detour.sort((a, b) => rank(b) - rank(a));

  // Headline = primary up to (limit - detourCap); pad with detour up to detourCap.
  const primaryRoom = Math.max(1, limit - Math.min(detourCap, detour.length));
  const out = primary.slice(0, primaryRoom).concat(detour.slice(0, Math.min(detourCap, limit - Math.min(primaryRoom, primary.length))));
  // If we still have headroom (primary was sparse), top up with more detour.
  if (out.length < limit) {
    const extra = detour.slice(Math.min(detourCap, limit - Math.min(primaryRoom, primary.length))).slice(0, limit - out.length);
    out.push(...extra);
  }
  return out.slice(0, limit);
}

/**
 * Display rank: raw value score + worldwide/vacation/premium-long-haul boosts.
 * HC #618 R3: when `preferFarther`, longhaul (>3000mi) gets an extra +0.30 and
 * short-haul near-home hops get a small penalty so the international vacation
 * deals float to the top.
 */
export function rankScore(d: AwardDeal, opts?: { preferFarther?: boolean }): number {
  let s = d.score;
  if (d.intl) s += 0.2;
  if (d.vacation) s += 0.1;
  if ((d.cabin === 'business' || d.cabin === 'first') && d.distanceMi >= 3000) s += 0.1;
  // Home-anchored deals beat detours all else equal (small constant boost; the
  // primary/detour split in generateAwardDeals already enforces the cap).
  if (d.homeAnchored) s += 0.05;
  if (opts?.preferFarther) {
    if (d.distanceMi >= 3000) s += 0.3;
    if (d.distanceMi < 1500) s -= 0.2;
  }
  return s;
}

/**
 * Wall-card one-liner — HC #618 R4: every figure labels its trip type.
 * "Business to Tokyo — 60k pts + $45 one-way · verified Jul 14"
 */
export function awardDealSummary(d: AwardDeal): string {
  const cab = d.cabinLabel.charAt(0).toUpperCase() + d.cabinLabel.slice(1);
  const taxes = d.taxesUsd != null ? ` + $${Math.round(d.taxesUsd)}` : '';
  const when = (() => {
    const t = new Date(`${d.date}T00:00:00Z`);
    return Number.isNaN(t.getTime())
      ? d.date
      : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  })();
  const trip = d.tripType === 'round-trip' ? 'round-trip' : 'one-way';
  // HC #619 R4 — every card carries nights when known.
  const nights = d.nights != null
    ? ` · ${d.nights}n${d.longStay ? ' long stay' : ''}`
    : '';
  return `${cab} to ${d.cityTo} — ${Math.round(d.miles / 1000)}k pts${taxes} ${trip}${nights} · verified ${when}`;
}
