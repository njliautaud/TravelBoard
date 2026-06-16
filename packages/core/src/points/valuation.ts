/**
 * Points valuation engine (HC #602 req 4).
 *
 * For a deal (cash price + distance) and the user's HELD transfer-enabled
 * cards, enumerate every card→program→airline-partner path, estimate the
 * round-trip economy award cost from the distance-band tables, apply transfer
 * ratio + any ACTIVE transfer bonus, and compute cents-per-point achieved:
 *
 *   cpp = (cashPrice − estimated award fees) × 100 / programPointsNeeded
 *
 * HONESTY RULES (HC #582 spirit):
 *  - Award costs are ESTIMATES from published charts ('chart') or modeled
 *    medians ('heuristic') — `estimateQuality` is carried on every path.
 *  - `availabilityVerified` is false unless a live award-search source
 *    (seats.aero) confirmed seats. We never claim verified availability.
 *  - Negative-value paths (cpp below ~baseline) produce NO verdict — the
 *    honest answer is often "pay cash".
 */

import type {
  HeldCard,
  PointsPath,
  PointsValuation,
  ProgramId,
  TransferBonus,
} from './types.js';
import {
  AWARD_CHART_BY_PARTNER,
  CARD_CATALOG,
  PARTNER_BY_ID,
  PROGRAM_BY_ID,
  TRANSFER_EDGES,
} from './data/transfer-partners.js';
import {
  CABIN_LABELS,
  type Cabin,
  type VerifiedCabinAward,
  type VerifiedCabinValuation,
} from './sources/seats-aero.js';

/** Round-trip economy award estimate for a partner at a one-way distance. */
export function estimateAwardMiles(partnerId: string, oneWayDistanceMiles: number): {
  miles: number;
  feesEstUsd: number;
  quality: 'chart' | 'heuristic';
} | null {
  const chart = AWARD_CHART_BY_PARTNER.get(partnerId);
  if (!chart || !(oneWayDistanceMiles > 0)) return null;
  const band = chart.bands.find((b) => oneWayDistanceMiles <= b.maxMiles);
  if (!band) return null;
  return { miles: band.oneWayMiles * 2, feesEstUsd: chart.feesEstUsd, quality: chart.quality };
}

/** Programs the user can actually transfer FROM, given held cards. */
export function transferablePrograms(held: HeldCard[]): ProgramId[] {
  const heldIds = new Set(held.filter((h) => h.held).map((h) => h.cardId));
  const programs = new Set<ProgramId>();
  for (const card of CARD_CATALOG) {
    if (heldIds.has(card.id) && card.transferEnabled) programs.add(card.program);
  }
  return [...programs];
}

export interface ValuationInputs {
  flyTo: string;
  /** round-trip cash price USD */
  cashPrice: number;
  /** ONE-WAY great-circle distance, miles (FareQuote.distance) */
  distanceMiles: number;
  held: HeldCard[];
  bonuses: TransferBonus[];
  /** true when a live award-availability source is healthy */
  availabilityVerified?: boolean;
  /** minimum cpp for a path to be "worth it" (default 1.3) */
  minCpp?: number;
}

export function valuateDeal(inp: ValuationInputs): PointsValuation {
  const programs = transferablePrograms(inp.held);
  const minCpp = inp.minCpp ?? 1.3;
  const paths: PointsPath[] = [];

  for (const programId of programs) {
    const program = PROGRAM_BY_ID.get(programId);
    if (!program) continue;
    for (const edge of TRANSFER_EDGES) {
      if (edge.program !== programId) continue;
      const partner = PARTNER_BY_ID.get(edge.partner);
      if (!partner || partner.kind !== 'airline') continue; // flight deals → airline paths only
      const est = estimateAwardMiles(edge.partner, inp.distanceMiles);
      if (!est) continue; // no estimator for this partner — honest exclusion

      const active = inp.bonuses.find(
        (b) => b.program === programId && b.partner === edge.partner,
      );
      const bonus = active?.bonus ?? 0;
      const effectiveRatio = edge.ratio * (1 + bonus);
      const programPointsNeeded = Math.ceil(est.miles / effectiveRatio / 1000) * 1000; // transfers move in 1k blocks
      const netCash = Math.max(0, inp.cashPrice - est.feesEstUsd);
      if (programPointsNeeded <= 0 || netCash <= 0) continue;
      const cpp = Math.round(((netCash * 100) / programPointsNeeded) * 100) / 100;

      const k = (n: number) => `${Math.round(n / 1000)}k`;
      const bonusTxt = bonus > 0 ? ` (${Math.round(bonus * 100)}% bonus${active?.endDate ? ` thru ${active.endDate}` : ''})` : '';
      const verdict =
        `transfer ${k(programPointsNeeded)} ${program.name}→${partner.name}${bonusTxt} ` +
        `≈ $${Math.round(inp.cashPrice)} fare for ~$${Math.round((programPointsNeeded * program.baselineCpp) / 100)} of points value — ` +
        `${cpp.toFixed(1)}cpp vs ${program.baselineCpp.toFixed(1)}cpp baseline (est. +$${Math.round(est.feesEstUsd)} fees)`;

      paths.push({
        program: programId,
        programName: program.name,
        partner: edge.partner,
        partnerName: partner.name,
        ratio: edge.ratio,
        bonus,
        partnerMilesNeeded: est.miles,
        programPointsNeeded,
        feesEstUsd: est.feesEstUsd,
        cpp,
        baselineCpp: program.baselineCpp,
        verdict,
        estimateQuality: est.quality,
      });
    }
  }

  paths.sort((a, b) => b.cpp - a.cpp);
  const best = paths.length && paths[0]!.cpp >= minCpp ? paths[0]! : null;

  return {
    flyTo: inp.flyTo,
    cashPrice: inp.cashPrice,
    distanceMiles: inp.distanceMiles,
    best,
    paths: paths.slice(0, 5),
    bonusApplied: best != null && best.bonus > 0,
    availabilityVerified: inp.availabilityVerified ?? false,
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// HC #608 — VERIFIED-award cpp valuation, all four cabins (seats.aero Pro live)
// ---------------------------------------------------------------------------

/**
 * seats.aero `Source` keys → our transfer-partner ids. Programs absent here
 * (smiles, azul, saudia, velocity, spirit, frontier, eurobonus…) have no
 * transfer edge in our graph → their verified awards are surfaced but honestly
 * carry NO cpp valuation (you can't get there from a held card).
 */
export const SEATS_SOURCE_TO_PARTNER: Record<string, string> = {
  aeroplan: 'aeroplan',
  aeromexico: 'aeromexico',
  alaska: 'alaska',
  american: 'american',
  delta: 'delta',
  emirates: 'emirates',
  etihad: 'etihad',
  flyingblue: 'flying_blue',
  jetblue: 'jetblue',
  lifemiles: 'avianca',
  qantas: 'qantas',
  qatar: 'qatar_avios',
  singapore: 'singapore',
  southwest: 'southwest',
  turkish: 'turkish',
  united: 'united',
  virginatlantic: 'virgin_atlantic',
};

/**
 * MODELED round-trip cabin-fare benchmark = economy quote × multiplier.
 * HONESTY: no cash source quotes premium cabins, so premium cpp uses these
 * documented, conservative long-haul ratios (industry medians; J typically
 * 3–4× Y, F 4.5–6× Y — we sit at the LOW end so cpp is never flattered).
 * The result is labeled `fareBasis: 'modeled'` all the way to the UI.
 * Economy uses the REAL quote (multiplier 1 ⇒ `fareBasis: 'cash'`).
 */
export const CABIN_FARE_MULTIPLIERS: Record<Cabin, number> = {
  economy: 1,
  premiumEconomy: 1.8,
  business: 3.0,
  first: 4.5,
};

export interface VerifiedCabinValuationInputs {
  award: VerifiedCabinAward;
  /** REAL round-trip economy cash quote for the destination, USD */
  cashPriceEconomyRt: number;
  held: HeldCard[];
  bonuses: TransferBonus[];
}

/**
 * Best held-card transfer path to pay a VERIFIED award (any cabin), with cpp.
 *
 * - Award miles from seats.aero are ONE-WAY → round trip = 2× miles and 2×
 *   taxes (assumes symmetric return space; the verified flag itself is per
 *   one-way date — stated in the verdict copy as "each way").
 * - cpp numerator: reference RT fare (real for economy, modeled for W/J/F)
 *   minus award taxes. Denominator: program points after ratio + active bonus,
 *   1k transfer blocks.
 * - Returns null when no held program transfers to the award's program — the
 *   honest answer, never a fabricated path.
 */
export function valuateVerifiedCabin(inp: VerifiedCabinValuationInputs): VerifiedCabinValuation | null {
  const partnerId = SEATS_SOURCE_TO_PARTNER[inp.award.program];
  if (!partnerId || !(inp.cashPriceEconomyRt > 0) || !(inp.award.miles > 0)) return null;
  const partner = PARTNER_BY_ID.get(partnerId);
  if (!partner) return null;

  const cabin = inp.award.cabin;
  const refFareUsd = Math.round(inp.cashPriceEconomyRt * CABIN_FARE_MULTIPLIERS[cabin]);
  const fareBasis: 'cash' | 'modeled' = cabin === 'economy' ? 'cash' : 'modeled';
  const rtMiles = inp.award.miles * 2;
  const rtTaxes = (inp.award.taxesUsd ?? 0) * 2;
  const netCash = Math.max(0, refFareUsd - rtTaxes);
  if (netCash <= 0) return null;

  const programs = transferablePrograms(inp.held);
  let best: VerifiedCabinValuation | null = null;
  for (const programId of programs) {
    const program = PROGRAM_BY_ID.get(programId);
    if (!program) continue;
    const edge = TRANSFER_EDGES.find((e) => e.program === programId && e.partner === partnerId);
    if (!edge) continue;
    const active = inp.bonuses.find((b) => b.program === programId && b.partner === partnerId);
    const bonus = active?.bonus ?? 0;
    const effectiveRatio = edge.ratio * (1 + bonus);
    const programPointsNeeded = Math.ceil(rtMiles / effectiveRatio / 1000) * 1000;
    if (programPointsNeeded <= 0) continue;
    const cpp = Math.round(((netCash * 100) / programPointsNeeded) * 100) / 100;
    if (best && cpp <= best.cpp) continue;

    const k = (n: number) => `${Math.round(n / 1000)}k`;
    const bonusTxt = bonus > 0 ? ` (${Math.round(bonus * 100)}% bonus${active?.endDate ? ` thru ${active.endDate}` : ''})` : '';
    const fareTxt = fareBasis === 'cash'
      ? `$${refFareUsd} cash fare`
      : `modeled ~$${refFareUsd} ${CABIN_LABELS[cabin]} fare (${CABIN_FARE_MULTIPLIERS[cabin]}× economy)`;
    const verdict =
      `transfer ${k(programPointsNeeded)} ${program.name}→${partner.name}${bonusTxt} ` +
      `for VERIFIED ${CABIN_LABELS[cabin]} award space (${k(inp.award.miles)} miles each way) ` +
      `≈ ${cpp.toFixed(1)}cpp vs ${fareTxt}`;

    best = {
      cabin,
      program: programId,
      programName: program.name,
      partner: partnerId,
      partnerName: partner.name,
      bonus,
      programPointsNeeded,
      cpp,
      refFareUsd,
      fareBasis,
      verdict,
    };
  }
  return best;
}
