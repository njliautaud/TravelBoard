/**
 * Deal scoring service — ported from Meridian's deal-scoring.ts.
 *
 * Computes a multi-factor quality score for deals, weighting:
 *   1. Price vs historical average (biggest weight)
 *   2. Recency of the fare observation
 *   3. Airline quality (major carriers score higher)
 *   4. Number of stops (nonstop = best)
 *   5. Travel time efficiency
 */

export interface ScoreFactor {
  name: string;
  label: string;
  value: number;
  weight: number;
  detail: string;
}

export interface DealScoreBreakdown {
  totalScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  factors: ScoreFactor[];
  summary: string;
}

/** Airline quality tiers. */
const AIRLINE_TIERS: Record<string, number> = {
  DL: 1.0, UA: 0.95, AA: 0.9, AS: 0.9, B6: 0.85, HA: 0.85,
  AC: 0.8, BA: 0.85, LH: 0.85, AF: 0.8, KL: 0.8,
  WN: 0.65, SY: 0.6, G4: 0.5, NK: 0.45, F9: 0.45,
};

function airlineScore(gate: string | null): { value: number; detail: string } {
  if (!gate) return { value: 0.6, detail: "Unknown airline" };
  const code = gate.toUpperCase().slice(0, 2);
  const score = AIRLINE_TIERS[code] ?? 0.6;
  if (score >= 0.85) return { value: score, detail: `Premium carrier (${code})` };
  if (score >= 0.65) return { value: score, detail: `Major carrier (${code})` };
  return { value: score, detail: `Budget carrier (${code})` };
}

function recencyScore(fetchedAt: string | null): { value: number; detail: string } {
  if (!fetchedAt) return { value: 0.5, detail: "Unknown age" };
  const ageHours = (Date.now() - new Date(fetchedAt).getTime()) / 3_600_000;
  if (ageHours < 6) return { value: 1.0, detail: `${Math.round(ageHours)}h old` };
  if (ageHours < 12) return { value: 0.85, detail: `${Math.round(ageHours)}h old` };
  if (ageHours < 24) return { value: 0.7, detail: `${Math.round(ageHours)}h old` };
  if (ageHours < 48) return { value: 0.5, detail: `${Math.round(ageHours / 24)}d old` };
  return { value: 0.3, detail: `${Math.round(ageHours / 24)}d old` };
}

function priceScore(
  price: number,
  baseline: number | null,
): { value: number; detail: string } {
  if (!baseline || baseline <= 0)
    return { value: 0.5, detail: "No historical baseline" };
  const ratio = price / baseline;
  if (ratio <= 0.5) return { value: 1.0, detail: `${Math.round((1 - ratio) * 100)}% below typical` };
  if (ratio <= 0.7) return { value: 0.9, detail: `${Math.round((1 - ratio) * 100)}% below typical` };
  if (ratio <= 0.85) return { value: 0.75, detail: `${Math.round((1 - ratio) * 100)}% below typical` };
  if (ratio <= 0.95) return { value: 0.55, detail: `${Math.round((1 - ratio) * 100)}% below typical` };
  if (ratio <= 1.05) return { value: 0.35, detail: "Near typical price" };
  return { value: 0.15, detail: `${Math.round((ratio - 1) * 100)}% above typical` };
}

/** Factor weights (sum to 1.0). */
const WEIGHTS = {
  price: 0.50,
  recency: 0.20,
  airline: 0.15,
  stops: 0.15,
};

export function scoreDeal(deal: {
  price: number;
  baseline?: number | null;
  fetchedAt?: string | null;
  airline?: string | null;
  transfers?: number | null;
}): DealScoreBreakdown {
  const priceFactor = priceScore(deal.price, deal.baseline ?? null);
  const recencyFactor = recencyScore(deal.fetchedAt ?? null);
  const airlineFactor = airlineScore(deal.airline ?? null);

  // Stops scoring inline
  const transfers = deal.transfers ?? null;
  let stopsValue = 0.5;
  let stopsDetail = "Stops unknown";
  if (transfers === 0) { stopsValue = 1.0; stopsDetail = "Nonstop"; }
  else if (transfers === 1) { stopsValue = 0.65; stopsDetail = "1 stop"; }
  else if (transfers != null) { stopsValue = 0.35; stopsDetail = `${transfers} stops`; }

  const factors: ScoreFactor[] = [
    { name: "price", label: "Price vs Typical", value: priceFactor.value, weight: WEIGHTS.price, detail: priceFactor.detail },
    { name: "recency", label: "Data Freshness", value: recencyFactor.value, weight: WEIGHTS.recency, detail: recencyFactor.detail },
    { name: "airline", label: "Airline Quality", value: airlineFactor.value, weight: WEIGHTS.airline, detail: airlineFactor.detail },
    { name: "stops", label: "Routing", value: stopsValue, weight: WEIGHTS.stops, detail: stopsDetail },
  ];

  const totalScore = Math.round(
    factors.reduce((sum, f) => sum + f.value * f.weight, 0) * 100,
  );

  let grade: DealScoreBreakdown["grade"];
  if (totalScore >= 80) grade = "A";
  else if (totalScore >= 65) grade = "B";
  else if (totalScore >= 50) grade = "C";
  else if (totalScore >= 35) grade = "D";
  else grade = "F";

  const topFactor = factors.reduce((a, b) =>
    a.value * a.weight > b.value * b.weight ? a : b,
  );
  const summary =
    totalScore >= 65
      ? `Strong deal — ${topFactor.detail.toLowerCase()}`
      : totalScore >= 45
        ? `Decent deal — ${topFactor.detail.toLowerCase()}`
        : `Below average — ${(factors.find((f) => f.value < 0.5)?.detail ?? "weak factors").toLowerCase()}`;

  return { totalScore, grade, factors, summary };
}
