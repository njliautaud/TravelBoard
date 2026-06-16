/**
 * Transfer-partner knowledge graph — VERSIONED STATIC SEED DATASET (HC #602).
 *
 * Partners + ratios change rarely (a few times a year), so they live in-repo.
 *
 * ── UPDATE PATH (documented per HC #602 req 2) ──────────────────────────────
 * 1. Bump DATASET_VERSION + DATASET_UPDATED below.
 * 2. Cross-check each program's partner table against the issuer pages and the
 *    Frequent Miler "transfer partner master list" (frequentmiler.com); the
 *    live transfer-BONUS overlay is fetched separately and never edited here.
 * 3. `pnpm --filter @travelboard/core test` — points.test.ts enforces graph
 *    integrity (every edge resolves, ratios sane, every card's program exists).
 * 4. Note the change in TRAVELBOARD_POINTS_CHANGELOG.md.
 *
 * Seed verified against public partner lists as of 2026-06. Ratios are
 * program-points → partner-points multipliers (1.0 = 1:1).
 */

import type {
  CardDefinition,
  PointsProgram,
  TransferEdge,
  TransferPartner,
} from '../types.js';

export const DATASET_VERSION = '2026.06.1';
export const DATASET_UPDATED = '2026-06-11';

// ---------------------------------------------------------------------------
// Programs (the six major transferable ecosystems)
// ---------------------------------------------------------------------------

export const PROGRAMS: PointsProgram[] = [
  { id: 'chase_ur', name: 'Chase Ultimate Rewards', baselineCpp: 1.0 },
  { id: 'amex_mr', name: 'Amex Membership Rewards', baselineCpp: 1.0 },
  { id: 'cap1_miles', name: 'Capital One Miles', baselineCpp: 1.0 },
  { id: 'citi_typ', name: 'Citi ThankYou Points', baselineCpp: 1.0 },
  { id: 'bilt', name: 'Bilt Rewards', baselineCpp: 1.25 },
  { id: 'wf_rewards', name: 'Wells Fargo Rewards', baselineCpp: 1.0 },
];

// ---------------------------------------------------------------------------
// Partners
// ---------------------------------------------------------------------------

export const PARTNERS: TransferPartner[] = [
  // Airlines
  { id: 'aeroplan', name: 'Air Canada Aeroplan', kind: 'airline', family: 'Star Alliance' },
  { id: 'flying_blue', name: 'Air France/KLM Flying Blue', kind: 'airline', family: 'SkyTeam' },
  { id: 'ba_avios', name: 'British Airways Executive Club (Avios)', kind: 'airline', family: 'oneworld' },
  { id: 'iberia_avios', name: 'Iberia Plus (Avios)', kind: 'airline', family: 'oneworld' },
  { id: 'aer_lingus_avios', name: 'Aer Lingus AerClub (Avios)', kind: 'airline', family: 'Avios' },
  { id: 'qatar_avios', name: 'Qatar Airways Privilege Club (Avios)', kind: 'airline', family: 'oneworld' },
  { id: 'virgin_atlantic', name: 'Virgin Atlantic Flying Club', kind: 'airline', family: 'SkyTeam' },
  { id: 'united', name: 'United MileagePlus', kind: 'airline', family: 'Star Alliance' },
  { id: 'southwest', name: 'Southwest Rapid Rewards', kind: 'airline' },
  { id: 'jetblue', name: 'JetBlue TrueBlue', kind: 'airline' },
  { id: 'singapore', name: 'Singapore KrisFlyer', kind: 'airline', family: 'Star Alliance' },
  { id: 'emirates', name: 'Emirates Skywards', kind: 'airline' },
  { id: 'etihad', name: 'Etihad Guest', kind: 'airline' },
  { id: 'delta', name: 'Delta SkyMiles', kind: 'airline', family: 'SkyTeam' },
  { id: 'ana', name: 'ANA Mileage Club', kind: 'airline', family: 'Star Alliance' },
  { id: 'avianca', name: 'Avianca LifeMiles', kind: 'airline', family: 'Star Alliance' },
  { id: 'cathay', name: 'Cathay Pacific Asia Miles', kind: 'airline', family: 'oneworld' },
  { id: 'qantas', name: 'Qantas Frequent Flyer', kind: 'airline', family: 'oneworld' },
  { id: 'turkish', name: 'Turkish Miles&Smiles', kind: 'airline', family: 'Star Alliance' },
  { id: 'tap', name: 'TAP Miles&Go', kind: 'airline', family: 'Star Alliance' },
  { id: 'finnair', name: 'Finnair Plus', kind: 'airline', family: 'oneworld' },
  { id: 'eva', name: 'EVA Air Infinity MileageLands', kind: 'airline', family: 'Star Alliance' },
  { id: 'aeromexico', name: 'Aeromexico Rewards', kind: 'airline', family: 'SkyTeam' },
  { id: 'thai', name: 'Thai Royal Orchid Plus', kind: 'airline', family: 'Star Alliance' },
  { id: 'alaska', name: 'Alaska Atmos Rewards', kind: 'airline', family: 'oneworld' },
  { id: 'american', name: 'American Airlines AAdvantage', kind: 'airline', family: 'oneworld' },
  // Hotels
  { id: 'hyatt', name: 'World of Hyatt', kind: 'hotel' },
  { id: 'marriott', name: 'Marriott Bonvoy', kind: 'hotel' },
  { id: 'ihg', name: 'IHG One Rewards', kind: 'hotel' },
  { id: 'hilton', name: 'Hilton Honors', kind: 'hotel' },
  { id: 'choice', name: 'Choice Privileges', kind: 'hotel' },
  { id: 'wyndham', name: 'Wyndham Rewards', kind: 'hotel' },
  { id: 'accor', name: 'Accor Live Limitless', kind: 'hotel' },
];

// ---------------------------------------------------------------------------
// Edges: program → partner @ ratio
// ---------------------------------------------------------------------------

export const TRANSFER_EDGES: TransferEdge[] = [
  // Chase Ultimate Rewards — all 1:1
  { program: 'chase_ur', partner: 'aeroplan', ratio: 1 },
  { program: 'chase_ur', partner: 'flying_blue', ratio: 1 },
  { program: 'chase_ur', partner: 'ba_avios', ratio: 1 },
  { program: 'chase_ur', partner: 'iberia_avios', ratio: 1 },
  { program: 'chase_ur', partner: 'aer_lingus_avios', ratio: 1 },
  { program: 'chase_ur', partner: 'virgin_atlantic', ratio: 1 },
  { program: 'chase_ur', partner: 'united', ratio: 1 },
  { program: 'chase_ur', partner: 'southwest', ratio: 1 },
  { program: 'chase_ur', partner: 'jetblue', ratio: 1 },
  { program: 'chase_ur', partner: 'singapore', ratio: 1 },
  { program: 'chase_ur', partner: 'emirates', ratio: 1 },
  { program: 'chase_ur', partner: 'hyatt', ratio: 1 },
  { program: 'chase_ur', partner: 'marriott', ratio: 1 },
  { program: 'chase_ur', partner: 'ihg', ratio: 1 },

  // Amex Membership Rewards
  { program: 'amex_mr', partner: 'aeroplan', ratio: 1 },
  { program: 'amex_mr', partner: 'flying_blue', ratio: 1 },
  { program: 'amex_mr', partner: 'ba_avios', ratio: 1 },
  { program: 'amex_mr', partner: 'iberia_avios', ratio: 1 },
  { program: 'amex_mr', partner: 'aer_lingus_avios', ratio: 1 },
  { program: 'amex_mr', partner: 'qatar_avios', ratio: 1 },
  { program: 'amex_mr', partner: 'virgin_atlantic', ratio: 1 },
  { program: 'amex_mr', partner: 'singapore', ratio: 1 },
  { program: 'amex_mr', partner: 'emirates', ratio: 1 },
  { program: 'amex_mr', partner: 'etihad', ratio: 1 },
  { program: 'amex_mr', partner: 'delta', ratio: 1 },
  { program: 'amex_mr', partner: 'ana', ratio: 1 },
  { program: 'amex_mr', partner: 'avianca', ratio: 1 },
  { program: 'amex_mr', partner: 'cathay', ratio: 1 },
  { program: 'amex_mr', partner: 'qantas', ratio: 1 },
  { program: 'amex_mr', partner: 'aeromexico', ratio: 1.6 },
  { program: 'amex_mr', partner: 'jetblue', ratio: 0.8 },
  { program: 'amex_mr', partner: 'marriott', ratio: 1 },
  { program: 'amex_mr', partner: 'hilton', ratio: 2 },
  { program: 'amex_mr', partner: 'choice', ratio: 1 },

  // Capital One Miles
  { program: 'cap1_miles', partner: 'aeroplan', ratio: 1 },
  { program: 'cap1_miles', partner: 'flying_blue', ratio: 1 },
  { program: 'cap1_miles', partner: 'ba_avios', ratio: 1 },
  { program: 'cap1_miles', partner: 'qatar_avios', ratio: 1 },
  { program: 'cap1_miles', partner: 'virgin_atlantic', ratio: 1 },
  { program: 'cap1_miles', partner: 'singapore', ratio: 1 },
  { program: 'cap1_miles', partner: 'emirates', ratio: 1 },
  { program: 'cap1_miles', partner: 'etihad', ratio: 1 },
  { program: 'cap1_miles', partner: 'avianca', ratio: 1 },
  { program: 'cap1_miles', partner: 'cathay', ratio: 1 },
  { program: 'cap1_miles', partner: 'qantas', ratio: 1 },
  { program: 'cap1_miles', partner: 'turkish', ratio: 1 },
  { program: 'cap1_miles', partner: 'tap', ratio: 1 },
  { program: 'cap1_miles', partner: 'finnair', ratio: 1 },
  { program: 'cap1_miles', partner: 'aeromexico', ratio: 1 },
  { program: 'cap1_miles', partner: 'eva', ratio: 0.75 },
  { program: 'cap1_miles', partner: 'choice', ratio: 1 },
  { program: 'cap1_miles', partner: 'wyndham', ratio: 1 },
  { program: 'cap1_miles', partner: 'accor', ratio: 0.5 },

  // Citi ThankYou Points
  { program: 'citi_typ', partner: 'flying_blue', ratio: 1 },
  { program: 'citi_typ', partner: 'qatar_avios', ratio: 1 },
  { program: 'citi_typ', partner: 'virgin_atlantic', ratio: 1 },
  { program: 'citi_typ', partner: 'singapore', ratio: 1 },
  { program: 'citi_typ', partner: 'emirates', ratio: 1 },
  { program: 'citi_typ', partner: 'etihad', ratio: 1 },
  { program: 'citi_typ', partner: 'avianca', ratio: 1 },
  { program: 'citi_typ', partner: 'cathay', ratio: 1 },
  { program: 'citi_typ', partner: 'qantas', ratio: 1 },
  { program: 'citi_typ', partner: 'turkish', ratio: 1 },
  { program: 'citi_typ', partner: 'eva', ratio: 1 },
  { program: 'citi_typ', partner: 'thai', ratio: 1 },
  { program: 'citi_typ', partner: 'aeromexico', ratio: 1 },
  { program: 'citi_typ', partner: 'jetblue', ratio: 1 },
  { program: 'citi_typ', partner: 'american', ratio: 1 },
  { program: 'citi_typ', partner: 'choice', ratio: 2 },
  { program: 'citi_typ', partner: 'wyndham', ratio: 1 },
  { program: 'citi_typ', partner: 'accor', ratio: 0.5 },

  // Bilt Rewards
  { program: 'bilt', partner: 'aeroplan', ratio: 1 },
  { program: 'bilt', partner: 'flying_blue', ratio: 1 },
  { program: 'bilt', partner: 'ba_avios', ratio: 1 },
  { program: 'bilt', partner: 'iberia_avios', ratio: 1 },
  { program: 'bilt', partner: 'aer_lingus_avios', ratio: 1 },
  { program: 'bilt', partner: 'virgin_atlantic', ratio: 1 },
  { program: 'bilt', partner: 'united', ratio: 1 },
  { program: 'bilt', partner: 'alaska', ratio: 1 },
  { program: 'bilt', partner: 'american', ratio: 1 },
  { program: 'bilt', partner: 'avianca', ratio: 1 },
  { program: 'bilt', partner: 'cathay', ratio: 1 },
  { program: 'bilt', partner: 'emirates', ratio: 1 },
  { program: 'bilt', partner: 'turkish', ratio: 1 },
  { program: 'bilt', partner: 'hyatt', ratio: 1 },
  { program: 'bilt', partner: 'marriott', ratio: 1 },
  { program: 'bilt', partner: 'ihg', ratio: 1 },
  { program: 'bilt', partner: 'accor', ratio: 0.5 },

  // Wells Fargo Rewards (Autograph Journey ecosystem)
  { program: 'wf_rewards', partner: 'flying_blue', ratio: 1 },
  { program: 'wf_rewards', partner: 'avianca', ratio: 1 },
  { program: 'wf_rewards', partner: 'ba_avios', ratio: 1 },
  { program: 'wf_rewards', partner: 'aer_lingus_avios', ratio: 1 },
  { program: 'wf_rewards', partner: 'iberia_avios', ratio: 1 },
  { program: 'wf_rewards', partner: 'virgin_atlantic', ratio: 1 },
  { program: 'wf_rewards', partner: 'choice', ratio: 2 },
];

// ---------------------------------------------------------------------------
// Card catalog (identity only — held/balance state lives in the API DB)
// ---------------------------------------------------------------------------

export const CARD_CATALOG: CardDefinition[] = [
  // Chase
  { id: 'chase_sapphire_preferred', name: 'Chase Sapphire Preferred', issuer: 'Chase', program: 'chase_ur', transferEnabled: true },
  { id: 'chase_sapphire_reserve', name: 'Chase Sapphire Reserve', issuer: 'Chase', program: 'chase_ur', transferEnabled: true },
  { id: 'chase_ink_preferred', name: 'Chase Ink Business Preferred', issuer: 'Chase', program: 'chase_ur', transferEnabled: true },
  { id: 'chase_freedom_flex', name: 'Chase Freedom Flex', issuer: 'Chase', program: 'chase_ur', transferEnabled: false },
  { id: 'chase_freedom_unlimited', name: 'Chase Freedom Unlimited', issuer: 'Chase', program: 'chase_ur', transferEnabled: false },
  { id: 'chase_ink_cash', name: 'Chase Ink Business Cash', issuer: 'Chase', program: 'chase_ur', transferEnabled: false },
  { id: 'chase_ink_unlimited', name: 'Chase Ink Business Unlimited', issuer: 'Chase', program: 'chase_ur', transferEnabled: false },
  // Amex
  { id: 'amex_platinum', name: 'Amex Platinum', issuer: 'Amex', program: 'amex_mr', transferEnabled: true },
  { id: 'amex_gold', name: 'Amex Gold', issuer: 'Amex', program: 'amex_mr', transferEnabled: true },
  { id: 'amex_green', name: 'Amex Green', issuer: 'Amex', program: 'amex_mr', transferEnabled: true },
  { id: 'amex_biz_platinum', name: 'Amex Business Platinum', issuer: 'Amex', program: 'amex_mr', transferEnabled: true },
  { id: 'amex_biz_gold', name: 'Amex Business Gold', issuer: 'Amex', program: 'amex_mr', transferEnabled: true },
  { id: 'amex_blue_biz_plus', name: 'Amex Blue Business Plus', issuer: 'Amex', program: 'amex_mr', transferEnabled: true },
  // Capital One
  { id: 'cap1_venture_x', name: 'Capital One Venture X', issuer: 'Capital One', program: 'cap1_miles', transferEnabled: true },
  { id: 'cap1_venture', name: 'Capital One Venture', issuer: 'Capital One', program: 'cap1_miles', transferEnabled: true },
  { id: 'cap1_venture_one', name: 'Capital One VentureOne', issuer: 'Capital One', program: 'cap1_miles', transferEnabled: true },
  { id: 'cap1_spark_miles', name: 'Capital One Spark Miles', issuer: 'Capital One', program: 'cap1_miles', transferEnabled: true },
  // Citi
  { id: 'citi_strata_premier', name: 'Citi Strata Premier', issuer: 'Citi', program: 'citi_typ', transferEnabled: true },
  { id: 'citi_double_cash', name: 'Citi Double Cash', issuer: 'Citi', program: 'citi_typ', transferEnabled: false },
  { id: 'citi_rewards_plus', name: 'Citi Rewards+', issuer: 'Citi', program: 'citi_typ', transferEnabled: false },
  // Bilt
  { id: 'bilt_mastercard', name: 'Bilt Mastercard', issuer: 'Bilt / Wells Fargo', program: 'bilt', transferEnabled: true },
  // Wells Fargo
  { id: 'wf_autograph_journey', name: 'Wells Fargo Autograph Journey', issuer: 'Wells Fargo', program: 'wf_rewards', transferEnabled: true },
  { id: 'wf_autograph', name: 'Wells Fargo Autograph', issuer: 'Wells Fargo', program: 'wf_rewards', transferEnabled: false },
];

// ---------------------------------------------------------------------------
// Award-cost estimation tables (round-trip ECONOMY, miles, by one-way
// great-circle distance band). 'chart' entries follow published distance
// charts (Avios family); 'heuristic' entries are modeled medians — clearly
// labeled in valuations and never presented as availability-verified.
// ---------------------------------------------------------------------------

export interface AwardBand {
  /** one-way distance ceiling, miles */
  maxMiles: number;
  /** ONE-WAY economy award cost, partner miles (off-peak/base) */
  oneWayMiles: number;
}

export interface AwardChart {
  partner: string;
  quality: 'chart' | 'heuristic';
  bands: AwardBand[];
  /** flat round-trip taxes/fees estimate USD (economy; carrier-surcharge aware) */
  feesEstUsd: number;
}

export const AWARD_CHARTS: AwardChart[] = [
  {
    // British Airways Avios published distance bands (economy, off-peak)
    partner: 'ba_avios',
    quality: 'chart',
    bands: [
      { maxMiles: 650, oneWayMiles: 6_000 },
      { maxMiles: 1_151, oneWayMiles: 9_000 },
      { maxMiles: 2_000, oneWayMiles: 11_000 },
      { maxMiles: 3_000, oneWayMiles: 13_000 },
      { maxMiles: 4_000, oneWayMiles: 20_750 },
      { maxMiles: 5_500, oneWayMiles: 25_750 },
      { maxMiles: 6_500, oneWayMiles: 31_000 },
      { maxMiles: 7_000, oneWayMiles: 36_250 },
      { maxMiles: 100_000, oneWayMiles: 51_500 },
    ],
    feesEstUsd: 120, // BA-metal long-haul carries surcharges; partner metal less
  },
  {
    // Iberia Avios — same band structure, generally lower fees on Iberia metal
    partner: 'iberia_avios',
    quality: 'chart',
    bands: [
      { maxMiles: 650, oneWayMiles: 6_000 },
      { maxMiles: 1_151, oneWayMiles: 9_000 },
      { maxMiles: 2_000, oneWayMiles: 11_000 },
      { maxMiles: 3_000, oneWayMiles: 13_000 },
      { maxMiles: 4_000, oneWayMiles: 17_000 },
      { maxMiles: 5_500, oneWayMiles: 21_250 },
      { maxMiles: 6_500, oneWayMiles: 25_500 },
      { maxMiles: 7_000, oneWayMiles: 29_750 },
      { maxMiles: 100_000, oneWayMiles: 42_500 },
    ],
    feesEstUsd: 80,
  },
  {
    // Qatar Avios — Avios family band pricing (Qsuites aside, economy bands track BA)
    partner: 'qatar_avios',
    quality: 'heuristic',
    bands: [
      { maxMiles: 650, oneWayMiles: 6_000 },
      { maxMiles: 1_151, oneWayMiles: 9_000 },
      { maxMiles: 2_000, oneWayMiles: 11_000 },
      { maxMiles: 3_000, oneWayMiles: 13_000 },
      { maxMiles: 4_000, oneWayMiles: 20_750 },
      { maxMiles: 5_500, oneWayMiles: 25_750 },
      { maxMiles: 6_500, oneWayMiles: 31_000 },
      { maxMiles: 100_000, oneWayMiles: 51_500 },
    ],
    feesEstUsd: 100,
  },
  {
    // Air France/KLM Flying Blue — dynamic; modeled median "Promo-less" economy
    partner: 'flying_blue',
    quality: 'heuristic',
    bands: [
      { maxMiles: 1_500, oneWayMiles: 12_500 },
      { maxMiles: 3_000, oneWayMiles: 17_500 },
      { maxMiles: 4_500, oneWayMiles: 25_000 },
      { maxMiles: 6_000, oneWayMiles: 30_000 },
      { maxMiles: 100_000, oneWayMiles: 35_000 },
    ],
    feesEstUsd: 130,
  },
  {
    // Air Canada Aeroplan — published NA/Atlantic distance bands, economy low end
    partner: 'aeroplan',
    quality: 'heuristic',
    bands: [
      { maxMiles: 500, oneWayMiles: 6_000 },
      { maxMiles: 1_500, oneWayMiles: 10_000 },
      { maxMiles: 2_750, oneWayMiles: 12_500 },
      { maxMiles: 4_000, oneWayMiles: 35_000 },
      { maxMiles: 6_000, oneWayMiles: 40_000 },
      { maxMiles: 100_000, oneWayMiles: 45_000 },
    ],
    feesEstUsd: 80,
  },
  {
    // Virgin Atlantic Flying Club — modeled economy (heavy surcharges on VS metal)
    partner: 'virgin_atlantic',
    quality: 'heuristic',
    bands: [
      { maxMiles: 1_500, oneWayMiles: 7_500 },
      { maxMiles: 3_000, oneWayMiles: 12_500 },
      { maxMiles: 4_500, oneWayMiles: 20_000 },
      { maxMiles: 100_000, oneWayMiles: 30_000 },
    ],
    feesEstUsd: 220,
  },
  {
    // United MileagePlus — dynamic; modeled saver-economy medians
    partner: 'united',
    quality: 'heuristic',
    bands: [
      { maxMiles: 700, oneWayMiles: 7_500 },
      { maxMiles: 2_300, oneWayMiles: 12_500 },
      { maxMiles: 4_000, oneWayMiles: 30_000 },
      { maxMiles: 6_000, oneWayMiles: 35_000 },
      { maxMiles: 100_000, oneWayMiles: 40_000 },
    ],
    feesEstUsd: 22,
  },
  {
    // Avianca LifeMiles — region chart approximated by distance, low fees
    partner: 'avianca',
    quality: 'heuristic',
    bands: [
      { maxMiles: 1_000, oneWayMiles: 9_000 },
      { maxMiles: 2_300, oneWayMiles: 12_500 },
      { maxMiles: 4_000, oneWayMiles: 30_000 },
      { maxMiles: 6_000, oneWayMiles: 35_000 },
      { maxMiles: 100_000, oneWayMiles: 40_000 },
    ],
    feesEstUsd: 40,
  },
  {
    // Turkish Miles&Smiles — region chart approximated by distance
    partner: 'turkish',
    quality: 'heuristic',
    bands: [
      { maxMiles: 1_500, oneWayMiles: 10_000 },
      { maxMiles: 3_000, oneWayMiles: 15_000 },
      { maxMiles: 5_000, oneWayMiles: 30_000 },
      { maxMiles: 100_000, oneWayMiles: 35_000 },
    ],
    feesEstUsd: 180,
  },
];

// quick lookups
export const PROGRAM_BY_ID = new Map(PROGRAMS.map((p) => [p.id, p]));
export const PARTNER_BY_ID = new Map(PARTNERS.map((p) => [p.id, p]));
export const AWARD_CHART_BY_PARTNER = new Map(AWARD_CHARTS.map((c) => [c.partner, c]));
