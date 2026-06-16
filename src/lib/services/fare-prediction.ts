/**
 * Fare prediction service — ported from Meridian's fare-prediction.ts.
 *
 * Uses Prisma (PostgreSQL) with FareHistory model. Computes price momentum,
 * day-of-week effects, volatility, and gives buy-now-vs-wait recommendations.
 *
 * Methodology (transparent):
 *   1. Short-term momentum: 7-day avg vs 30-day avg -> rising/falling/stable
 *   2. Day-of-week effect: which days tend cheapest for this route
 *   3. Volatility: coefficient of variation (high vol = less confident)
 *   4. All analysis from OBSERVED data — never fabricated
 */

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PriceTrend = "dropping" | "rising" | "stable";
export type Confidence = "high" | "medium" | "low";

export interface FarePrediction {
  origin: string;
  destination: string;
  trend: PriceTrend;
  confidence: Confidence;
  summary: string;
  currentPrice: number | null;
  avgPrice7d: number | null;
  avgPrice30d: number | null;
  priceChange7dPct: number | null;
  bestDayOfWeek: string | null;
  volatility: number | null;
  dataPoints: number;
  recommendation: string;
  recentPrices: Array<{ date: string; price: number }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dayName(dow: number): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dow] ?? "";
}

function std(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// Prediction
// ---------------------------------------------------------------------------

export async function predictFare(origin: string, destination: string): Promise<FarePrediction> {
  const since90 = new Date(Date.now() - 90 * 86_400_000);

  const rows = await prisma.fareHistory.findMany({
    where: {
      origin,
      destination,
      recordedAt: { gte: since90 },
    },
    orderBy: { recordedAt: "asc" },
    select: { price: true, recordedAt: true },
  });

  const noData: FarePrediction = {
    origin,
    destination,
    trend: "stable",
    confidence: "low",
    summary: "Not enough price history yet to make a prediction. Check back after a few days of tracking.",
    currentPrice: null,
    avgPrice7d: null,
    avgPrice30d: null,
    priceChange7dPct: null,
    bestDayOfWeek: null,
    volatility: null,
    dataPoints: rows.length,
    recommendation: "Set a price alert and we'll notify you when the price drops.",
    recentPrices: [],
  };

  if (rows.length < 5) return noData;

  const prices = rows.map((r) => Number(r.price));
  const now = Date.now();

  // 7-day and 30-day averages
  const recent7 = rows
    .filter((r) => r.recordedAt.getTime() > now - 7 * 86_400_000)
    .map((r) => Number(r.price));
  const recent30 = rows
    .filter((r) => r.recordedAt.getTime() > now - 30 * 86_400_000)
    .map((r) => Number(r.price));

  const avg7 = recent7.length > 0 ? Math.round(recent7.reduce((a, b) => a + b, 0) / recent7.length) : null;
  const avg30 = recent30.length > 0 ? Math.round(recent30.reduce((a, b) => a + b, 0) / recent30.length) : null;
  const currentPrice = prices[prices.length - 1] ?? null;

  // Price change %
  const priceChange7dPct =
    avg7 != null && avg30 != null && avg30 > 0
      ? Math.round(((avg7 - avg30) / avg30) * 1000) / 10
      : null;

  // Trend
  let trend: PriceTrend = "stable";
  if (priceChange7dPct != null) {
    if (priceChange7dPct < -5) trend = "dropping";
    else if (priceChange7dPct > 5) trend = "rising";
  }

  // Volatility (coefficient of variation)
  const sample = recent30.length >= 3 ? recent30 : prices;
  const priceStd = std(sample);
  const priceMean = sample.reduce((a, b) => a + b, 0) / sample.length;
  const volatility = priceMean > 0 ? Math.round((priceStd / priceMean) * 1000) / 10 : null;

  // Confidence
  let confidence: Confidence = "medium";
  if (rows.length >= 30 && volatility != null && volatility < 10) confidence = "high";
  else if (rows.length < 10 || (volatility != null && volatility > 25)) confidence = "low";

  // Day-of-week analysis
  const byDow: Record<number, number[]> = {};
  for (const r of rows) {
    const dow = r.recordedAt.getUTCDay();
    (byDow[dow] ??= []).push(Number(r.price));
  }
  let bestDow: number | null = null;
  let bestDowAvg = Infinity;
  for (const [dow, ps] of Object.entries(byDow)) {
    if (ps.length < 2) continue;
    const avg = ps.reduce((a, b) => a + b, 0) / ps.length;
    if (avg < bestDowAvg) {
      bestDowAvg = avg;
      bestDow = parseInt(dow, 10);
    }
  }

  // Recent daily prices for sparkline
  const dailyBuckets = new Map<string, number[]>();
  for (const r of rows) {
    const day = r.recordedAt.toISOString().slice(0, 10);
    let bucket = dailyBuckets.get(day);
    if (!bucket) {
      bucket = [];
      dailyBuckets.set(day, bucket);
    }
    bucket.push(Number(r.price));
  }
  const recentPrices = Array.from(dailyBuckets.entries())
    .map(([date, ps]) => ({
      date,
      price: Math.round(ps.reduce((a, b) => a + b, 0) / ps.length),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-30);

  // Human-readable summary and recommendation
  let summary: string;
  let recommendation: string;
  if (trend === "dropping") {
    summary = `Prices for this route have dropped ${Math.abs(priceChange7dPct ?? 0)}% in the last week. `;
    if (confidence === "high") {
      summary += "This is a strong downward trend — prices may keep falling.";
      recommendation = "Prices are trending down. Consider waiting a few more days for a better deal, or set a price alert.";
    } else {
      summary += "The trend looks promising but prices can bounce back quickly.";
      recommendation = "Prices look good right now. Book if you're comfortable, or set an alert for your target price.";
    }
  } else if (trend === "rising") {
    summary = `Prices have risen ${priceChange7dPct ?? 0}% in the last week. `;
    if (confidence === "high") {
      summary += "This is a consistent upward trend — prices may continue climbing.";
      recommendation = "Prices are going up. If you like what you see now, book sooner rather than later.";
    } else {
      summary += "It could be a temporary spike or seasonal shift.";
      recommendation = "Prices are a bit elevated. Set a price alert to catch a potential dip.";
    }
  } else {
    summary = "Prices have been relatively stable on this route recently. ";
    if (currentPrice != null && avg30 != null && currentPrice < avg30) {
      summary += "Current price is slightly below the monthly average — a decent time to book.";
      recommendation = "Price looks fair. Book when you're ready — no big swings expected.";
    } else {
      summary += "No major swings expected in the near term.";
      recommendation = "Prices are steady. Set a price alert if you're waiting for a dip.";
    }
  }

  if (bestDow != null) {
    summary += ` Tip: prices tend to be cheapest on ${dayName(bestDow)}s for this route.`;
  }

  return {
    origin,
    destination,
    trend,
    confidence,
    summary,
    currentPrice,
    avgPrice7d: avg7,
    avgPrice30d: avg30,
    priceChange7dPct,
    bestDayOfWeek: bestDow != null ? dayName(bestDow) : null,
    volatility,
    dataPoints: rows.length,
    recommendation,
    recentPrices,
  };
}
