/**
 * Points service — ported from Meridian's points.ts + points-optimizer.ts.
 *
 * Uses Prisma (PostgreSQL) instead of Drizzle/SQLite. Provides:
 *   - Transfer graph with bonus tracking
 *   - Points calculator (cost across programs for a flight)
 *   - Transfer optimization (best path from user's held cards)
 *   - Sweet spot lookup
 *   - Card profile CRUD
 */

import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

// ---------------------------------------------------------------------------
// Transfer Graph (static knowledge base)
// ---------------------------------------------------------------------------

export interface TransferEdge {
  fromProgram: string;
  toPartner: string;
  ratio: number;
  bonus: number;
  bonusExpiry: string | null;
  minTransfer: number;
  transferTime: string;
}

export interface AwardSweetSpot {
  partner: string;
  route: string;
  cabin: string;
  pointsCost: number;
  notes: string;
  airline: string;
}

const TRANSFER_GRAPH: TransferEdge[] = [
  // Chase Ultimate Rewards
  { fromProgram: "chase_ur", toPartner: "United MileagePlus", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "instant" },
  { fromProgram: "chase_ur", toPartner: "Southwest Rapid Rewards", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "instant" },
  { fromProgram: "chase_ur", toPartner: "British Airways Avios", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "instant" },
  { fromProgram: "chase_ur", toPartner: "Air France-KLM Flying Blue", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "chase_ur", toPartner: "Hyatt World of Hyatt", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "instant" },
  { fromProgram: "chase_ur", toPartner: "IHG One Rewards", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "chase_ur", toPartner: "Marriott Bonvoy", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "chase_ur", toPartner: "Virgin Atlantic Flying Club", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "instant" },
  { fromProgram: "chase_ur", toPartner: "Singapore KrisFlyer", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  // Amex Membership Rewards
  { fromProgram: "amex_mr", toPartner: "Delta SkyMiles", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "instant" },
  { fromProgram: "amex_mr", toPartner: "British Airways Avios", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "amex_mr", toPartner: "Air France-KLM Flying Blue", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "amex_mr", toPartner: "ANA Mileage Club", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "2-3 days" },
  { fromProgram: "amex_mr", toPartner: "Singapore KrisFlyer", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "amex_mr", toPartner: "Virgin Atlantic Flying Club", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "instant" },
  { fromProgram: "amex_mr", toPartner: "Hilton Honors", ratio: 2.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "amex_mr", toPartner: "Marriott Bonvoy", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "amex_mr", toPartner: "Cathay Pacific Asia Miles", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  // Capital One Miles
  { fromProgram: "capital_one", toPartner: "Air France-KLM Flying Blue", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "capital_one", toPartner: "British Airways Avios", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "capital_one", toPartner: "Turkish Airlines Miles&Smiles", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "capital_one", toPartner: "Avianca LifeMiles", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "capital_one", toPartner: "Qantas Frequent Flyer", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  // Citi ThankYou
  { fromProgram: "citi_typ", toPartner: "Turkish Airlines Miles&Smiles", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "citi_typ", toPartner: "Singapore KrisFlyer", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "citi_typ", toPartner: "Air France-KLM Flying Blue", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "citi_typ", toPartner: "Virgin Atlantic Flying Club", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
  { fromProgram: "citi_typ", toPartner: "Cathay Pacific Asia Miles", ratio: 1.0, bonus: 0, bonusExpiry: null, minTransfer: 1000, transferTime: "1-2 days" },
];

// Card -> program mapping
const CARD_PROGRAMS: Record<string, string> = {
  chase_sapphire_reserve: "chase_ur",
  chase_sapphire_preferred: "chase_ur",
  chase_freedom_flex: "chase_ur",
  chase_united_club: "chase_ur",
  amex_platinum: "amex_mr",
  amex_gold: "amex_mr",
  amex_centurion: "amex_mr",
  amex_delta_reserve: "amex_mr",
  amex_delta_plat: "amex_mr",
  capital_one_venture_x: "capital_one",
  capital_one_venture: "capital_one",
  citi_premier: "citi_typ",
  citi_custom_cash: "citi_typ",
  citi_aadvantage_exec: "citi_typ",
};

const PROGRAM_LABELS: Record<string, string> = {
  chase_ur: "Chase Ultimate Rewards",
  amex_mr: "Amex Membership Rewards",
  capital_one: "Capital One Miles",
  citi_typ: "Citi ThankYou Points",
};

// Known card catalog for the card manager
export const CARD_CATALOG = [
  { id: "chase_sapphire_reserve", name: "Chase Sapphire Reserve", issuer: "Chase", program: "chase_ur", annualFee: 550 },
  { id: "chase_sapphire_preferred", name: "Chase Sapphire Preferred", issuer: "Chase", program: "chase_ur", annualFee: 95 },
  { id: "chase_freedom_flex", name: "Chase Freedom Flex", issuer: "Chase", program: "chase_ur", annualFee: 0 },
  { id: "chase_united_club", name: "Chase United Club Infinite", issuer: "Chase", program: "chase_ur", annualFee: 525 },
  { id: "amex_platinum", name: "Amex Platinum", issuer: "Amex", program: "amex_mr", annualFee: 695 },
  { id: "amex_gold", name: "Amex Gold", issuer: "Amex", program: "amex_mr", annualFee: 250 },
  { id: "amex_centurion", name: "Amex Centurion", issuer: "Amex", program: "amex_mr", annualFee: 5000 },
  { id: "amex_delta_reserve", name: "Amex Delta Reserve", issuer: "Amex", program: "amex_mr", annualFee: 650 },
  { id: "amex_delta_plat", name: "Amex Delta Platinum", issuer: "Amex", program: "amex_mr", annualFee: 350 },
  { id: "capital_one_venture_x", name: "Capital One Venture X", issuer: "Capital One", program: "capital_one", annualFee: 395 },
  { id: "capital_one_venture", name: "Capital One Venture", issuer: "Capital One", program: "capital_one", annualFee: 95 },
  { id: "citi_premier", name: "Citi Premier", issuer: "Citi", program: "citi_typ", annualFee: 95 },
  { id: "citi_custom_cash", name: "Citi Custom Cash", issuer: "Citi", program: "citi_typ", annualFee: 0 },
  { id: "citi_aadvantage_exec", name: "Citi AAdvantage Executive", issuer: "Citi", program: "citi_typ", annualFee: 595 },
] as const;

export type CardCatalogEntry = (typeof CARD_CATALOG)[number];

// Award chart sweet spots
const SWEET_SPOTS: AwardSweetSpot[] = [
  { partner: "British Airways Avios", route: "US Domestic Short", cabin: "economy", pointsCost: 7500, notes: "Under 1151 miles, off-peak", airline: "AA/Alaska" },
  { partner: "British Airways Avios", route: "US-Caribbean", cabin: "economy", pointsCost: 13000, notes: "East Coast to Caribbean", airline: "AA" },
  { partner: "Virgin Atlantic Flying Club", route: "US-Europe", cabin: "economy", pointsCost: 15000, notes: "ANA flights, incredible value", airline: "ANA" },
  { partner: "Air France-KLM Flying Blue", route: "US-Europe", cabin: "business", pointsCost: 53000, notes: "Monthly Promo Rewards flash sales", airline: "AF/KLM" },
  { partner: "Turkish Airlines Miles&Smiles", route: "US-Europe", cabin: "business", pointsCost: 45000, notes: "Star Alliance partners", airline: "Turkish/United" },
  { partner: "ANA Mileage Club", route: "US-Europe", cabin: "business", pointsCost: 88000, notes: "Round trip pricing", airline: "Star Alliance" },
  { partner: "ANA Mileage Club", route: "US-Japan", cabin: "business", pointsCost: 85000, notes: "Round trip required, amazing value", airline: "ANA" },
  { partner: "Virgin Atlantic Flying Club", route: "US-Japan", cabin: "business", pointsCost: 60000, notes: "One-way on ANA", airline: "ANA" },
  { partner: "Cathay Pacific Asia Miles", route: "US-Asia", cabin: "business", pointsCost: 70000, notes: "Cathay flagship route", airline: "Cathay Pacific" },
  { partner: "Singapore KrisFlyer", route: "US-SE Asia", cabin: "business", pointsCost: 92000, notes: "SQ Suites are legendary", airline: "Singapore Airlines" },
  { partner: "Turkish Airlines Miles&Smiles", route: "US-Middle East", cabin: "business", pointsCost: 45000, notes: "Istanbul stopover program", airline: "Turkish" },
  { partner: "Avianca LifeMiles", route: "US-South America", cabin: "business", pointsCost: 63000, notes: "Star Alliance partners", airline: "Star Alliance" },
  { partner: "Hyatt World of Hyatt", route: "Any", cabin: "hotel", pointsCost: 8000, notes: "Category 1-3 free nights", airline: "Hyatt" },
];

// Destination -> region mapping
const DEST_REGIONS: Record<string, string> = {
  LHR: "US-Europe", CDG: "US-Europe", FCO: "US-Europe", BCN: "US-Europe", AMS: "US-Europe",
  FRA: "US-Europe", LIS: "US-Europe", ATH: "US-Europe", IST: "US-Europe", MAD: "US-Europe",
  MUC: "US-Europe", DUB: "US-Europe", ZRH: "US-Europe", VIE: "US-Europe", CPH: "US-Europe",
  NRT: "US-Japan", HND: "US-Japan", KIX: "US-Japan",
  ICN: "US-Asia", HKG: "US-Asia", TPE: "US-Asia", PVG: "US-Asia", PEK: "US-Asia",
  BKK: "US-SE Asia", SIN: "US-SE Asia", SGN: "US-SE Asia", MNL: "US-SE Asia", DPS: "US-SE Asia",
  DEL: "US-Asia", BOM: "US-Asia",
  SJU: "US-Caribbean", CUN: "US-Caribbean", NAS: "US-Caribbean", MBJ: "US-Caribbean", PUJ: "US-Caribbean",
  GRU: "US-South America", BOG: "US-South America", SCL: "US-South America", LIM: "US-South America", EZE: "US-South America",
  DOH: "US-Middle East", DXB: "US-Middle East", AUH: "US-Middle East", TLV: "US-Middle East",
  LAX: "US Domestic Short", SFO: "US Domestic Short", ORD: "US Domestic Short", DFW: "US Domestic Short",
  MIA: "US Domestic Short", SEA: "US Domestic Short", BOS: "US Domestic Short", DEN: "US Domestic Short",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransferPath {
  fromProgram: string;
  fromProgramLabel: string;
  toPartner: string;
  pointsNeeded: number;
  pointsFromBalance: number;
  transferRatio: number;
  bonusPct: number;
  transferTime: string;
  cabin: string;
  route: string;
  sweetSpot: AwardSweetSpot | null;
  valueCentsPerPoint: number;
  cashAlternative: number | null;
}

export interface OptimizationResult {
  destination: string;
  region: string;
  bestPaths: TransferPath[];
  sweetSpots: AwardSweetSpot[];
  userPrograms: Array<{ program: string; label: string; balance: number; cards: string[] }>;
  summary: string;
}

export interface CalculatorResult {
  destination: string;
  region: string;
  cashPrice: number | null;
  cabin: string;
  options: Array<{
    partner: string;
    pointsCost: number;
    cabin: string;
    route: string;
    airline: string;
    notes: string;
    reachableFrom: string[];
    valueCpp: number | null;
  }>;
}

export interface CardProfileData {
  id: string;
  cardName: string;
  issuer: string | null;
  pointsBalance: number;
  annualFee: number | null;
  category: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Points Calculator
// ---------------------------------------------------------------------------

export function calculatePoints(
  destination: string,
  cashPrice: number | null,
  cabin: string = "economy",
): CalculatorResult {
  const dest = destination.toUpperCase();
  const region = DEST_REGIONS[dest] ?? "US-Europe";

  const applicableSpots = SWEET_SPOTS.filter((s) => {
    const routeMatch = s.route === region || s.route === "Any";
    const cabinMatch = cabin === "any" || s.cabin === cabin || s.cabin === "hotel";
    return routeMatch && cabinMatch;
  });

  const options = applicableSpots.map((spot) => {
    // Find which bank programs can reach this partner
    const reachableFrom = [
      ...new Set(
        TRANSFER_GRAPH
          .filter((e) => e.toPartner === spot.partner)
          .map((e) => PROGRAM_LABELS[e.fromProgram] ?? e.fromProgram)
      ),
    ];

    const valueCpp =
      cashPrice != null && cashPrice > 0
        ? Math.round(((cashPrice / spot.pointsCost) * 100) * 10) / 10
        : null;

    return {
      partner: spot.partner,
      pointsCost: spot.pointsCost,
      cabin: spot.cabin,
      route: spot.route,
      airline: spot.airline,
      notes: spot.notes,
      reachableFrom,
      valueCpp,
    };
  });

  options.sort((a, b) => a.pointsCost - b.pointsCost);

  return { destination: dest, region, cashPrice: cashPrice ?? null, cabin, options };
}

// ---------------------------------------------------------------------------
// Transfer Optimizer
// ---------------------------------------------------------------------------

export async function optimizeTransfer(
  userId: string,
  destination: string,
  cashPrice: number | null,
  cabin: string = "economy",
): Promise<OptimizationResult> {
  const dest = destination.toUpperCase();
  const region = DEST_REGIONS[dest] ?? "US-Europe";

  // Load user's cards from DB
  const cards = await prisma.cardProfile.findMany({
    where: { userId },
  });

  // Group by program
  const programBalances = new Map<string, { balance: number; cards: string[] }>();
  for (const card of cards) {
    const program = CARD_PROGRAMS[card.cardName] ?? card.category;
    if (!program) continue;
    const existing = programBalances.get(program) ?? { balance: 0, cards: [] };
    existing.balance += card.pointsBalance;
    existing.cards.push(card.cardName);
    programBalances.set(program, existing);
  }

  // Find applicable sweet spots
  const applicableSpots = SWEET_SPOTS.filter((s) => {
    const routeMatch = s.route === region || s.route === "Any";
    const cabinMatch = cabin === "any" || s.cabin === cabin || s.cabin === "hotel";
    return routeMatch && cabinMatch;
  });

  // Build transfer paths
  const paths: TransferPath[] = [];
  for (const [program, info] of programBalances) {
    const edges = TRANSFER_GRAPH.filter((e) => e.fromProgram === program);
    for (const edge of edges) {
      const spots = applicableSpots.filter((s) => s.partner === edge.toPartner);
      for (const spot of spots) {
        const effectiveRatio = edge.ratio * (1 + edge.bonus);
        const pointsNeeded = Math.ceil(spot.pointsCost / effectiveRatio);
        const valueCpp = cashPrice != null && cashPrice > 0
          ? Math.round(((cashPrice / spot.pointsCost) * 100) * 10) / 10
          : 0;

        paths.push({
          fromProgram: program,
          fromProgramLabel: PROGRAM_LABELS[program] ?? program,
          toPartner: edge.toPartner,
          pointsNeeded,
          pointsFromBalance: Math.min(info.balance, pointsNeeded),
          transferRatio: edge.ratio,
          bonusPct: edge.bonus * 100,
          transferTime: edge.transferTime,
          cabin: spot.cabin,
          route: spot.route,
          sweetSpot: spot,
          valueCentsPerPoint: valueCpp,
          cashAlternative: cashPrice,
        });
      }
    }
  }

  paths.sort((a, b) => a.pointsNeeded - b.pointsNeeded);

  const userPrograms = Array.from(programBalances.entries()).map(([program, info]) => ({
    program,
    label: PROGRAM_LABELS[program] ?? program,
    balance: info.balance,
    cards: info.cards,
  }));

  const best = paths[0];
  const summary = best
    ? `Best option: ${best.pointsNeeded.toLocaleString()} ${best.fromProgramLabel} points to ${best.toPartner} for ${best.cabin} to ${region}. ${best.transferTime} transfer.`
    : cards.length === 0
      ? "Add your credit cards to see transfer options."
      : "No direct transfer paths found for this route. Try a different cabin or destination.";

  return {
    destination: dest,
    region,
    bestPaths: paths.slice(0, 10),
    sweetSpots: applicableSpots,
    userPrograms,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Sweet Spots
// ---------------------------------------------------------------------------

export function getSweetSpots(region?: string, cabin?: string): AwardSweetSpot[] {
  let spots = [...SWEET_SPOTS];
  if (region) spots = spots.filter((s) => s.route === region || s.route === "Any");
  if (cabin) spots = spots.filter((s) => s.cabin === cabin);
  return spots;
}

export function getTransferBonuses(): TransferEdge[] {
  return TRANSFER_GRAPH.filter((e) => e.bonus > 0);
}

export function getAllPrograms() {
  return { programs: PROGRAM_LABELS, edges: TRANSFER_GRAPH };
}

// ---------------------------------------------------------------------------
// Card Profile CRUD
// ---------------------------------------------------------------------------

export async function listCardProfiles(userId: string): Promise<CardProfileData[]> {
  const cards = await prisma.cardProfile.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return cards.map(toCardData);
}

export async function createCardProfile(
  userId: string,
  data: { cardName: string; issuer?: string; pointsBalance?: number; annualFee?: number; category?: string },
): Promise<CardProfileData> {
  const card = await prisma.cardProfile.create({
    data: {
      userId,
      cardName: data.cardName,
      issuer: data.issuer ?? null,
      pointsBalance: data.pointsBalance ?? 0,
      annualFee: data.annualFee != null ? new Decimal(data.annualFee) : null,
      category: data.category ?? null,
    },
  });
  return toCardData(card);
}

export async function updateCardProfile(
  id: string,
  userId: string,
  data: { cardName?: string; issuer?: string; pointsBalance?: number; annualFee?: number; category?: string },
): Promise<CardProfileData | null> {
  const existing = await prisma.cardProfile.findFirst({ where: { id, userId } });
  if (!existing) return null;
  const card = await prisma.cardProfile.update({
    where: { id },
    data: {
      ...(data.cardName != null && { cardName: data.cardName }),
      ...(data.issuer !== undefined && { issuer: data.issuer ?? null }),
      ...(data.pointsBalance != null && { pointsBalance: data.pointsBalance }),
      ...(data.annualFee !== undefined && { annualFee: data.annualFee != null ? new Decimal(data.annualFee) : null }),
      ...(data.category !== undefined && { category: data.category ?? null }),
    },
  });
  return toCardData(card);
}

export async function deleteCardProfile(id: string, userId: string): Promise<boolean> {
  const existing = await prisma.cardProfile.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await prisma.cardProfile.delete({ where: { id } });
  return true;
}

function toCardData(card: {
  id: string;
  cardName: string;
  issuer: string | null;
  pointsBalance: number;
  annualFee: Decimal | null;
  category: string | null;
  createdAt: Date;
}): CardProfileData {
  return {
    id: card.id,
    cardName: card.cardName,
    issuer: card.issuer,
    pointsBalance: card.pointsBalance,
    annualFee: card.annualFee ? Number(card.annualFee) : null,
    category: card.category,
    createdAt: card.createdAt.toISOString(),
  };
}
