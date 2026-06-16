/**
 * Unified search service — cross-corpus search over airports, destinations,
 * and cached fares. Ported from Meridian's search + smart-search services,
 * adapted for TravelBoard's Prisma-backed data layer.
 */

import {
  INTERNATIONAL_AIRPORTS,
  DESTINATIONS,
  searchAirports,
  type InternationalAirport,
  type Destination,
  type FareQuote,
} from "@travelboard/core";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SearchKind = "airport" | "destination" | "fare";

export interface SearchHit {
  kind: SearchKind;
  score: number;
  label: string;
  sublabel: string;
  code: string;
  lat: number;
  lon: number;
  airport?: InternationalAirport;
  destination?: Destination;
  fare?: {
    price: number;
    origin: string;
    destination: string;
    dealScore: number | null;
    source: string | null;
  };
}

export interface SearchOptions {
  q: string;
  limit?: number;
  kinds?: SearchKind[];
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function scoreAirport(q: string, a: InternationalAirport): number {
  const Q = q.toLowerCase();
  if (a.iata.toLowerCase() === Q) return 100;
  if (a.city.toLowerCase().startsWith(Q)) return 80;
  if (a.city.toLowerCase().includes(Q)) return 60;
  if (a.name.toLowerCase().includes(Q)) return 45;
  if (a.country.toLowerCase().includes(Q)) return 25;
  return 0;
}

function scoreDestination(q: string, d: Destination): number {
  const Q = q.toLowerCase();
  if (d.code.toLowerCase() === Q) return 95;
  if (d.city.toLowerCase().startsWith(Q)) return 75;
  if (d.city.toLowerCase().includes(Q)) return 55;
  if (d.country.toLowerCase().includes(Q)) return 25;
  if (d.themes.some((t) => t.toLowerCase() === Q)) return 50;
  return 0;
}

// ---------------------------------------------------------------------------
// Main search (local corpus — no external calls)
// ---------------------------------------------------------------------------

export function searchLocal(opts: SearchOptions): SearchHit[] {
  const q = opts.q.trim();
  if (!q) return [];
  const limit = opts.limit ?? 25;
  const want = new Set<SearchKind>(opts.kinds ?? ["airport", "destination"]);
  const hits: SearchHit[] = [];

  if (want.has("airport")) {
    for (const a of INTERNATIONAL_AIRPORTS) {
      const s = scoreAirport(q, a);
      if (s > 0) {
        hits.push({
          kind: "airport",
          score: s,
          label: `${a.city} (${a.iata})`,
          sublabel: `${a.name} - ${a.country}`,
          code: a.iata,
          lat: a.lat,
          lon: a.lon,
          airport: a,
        });
      }
    }
  }

  if (want.has("destination")) {
    for (const d of DESTINATIONS) {
      const s = scoreDestination(q, d);
      if (s > 0) {
        hits.push({
          kind: "destination",
          score: s,
          label: `${d.city} (${d.code})`,
          sublabel: `${d.country} - ${d.themes.join(", ")}`,
          code: d.code,
          lat: d.lat,
          lon: d.lon,
          destination: d,
        });
      }
    }
  }

  hits.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return hits.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Smart search — natural language query parsing
// ---------------------------------------------------------------------------

const MONTH_KEYWORDS: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2,
  april: 3, apr: 3, may: 4, june: 5, jun: 5,
  july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8,
  october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
};

const RELATIVE_TIME: Record<string, () => number> = {
  "next month": () => (new Date().getMonth() + 1) % 12,
  "this month": () => new Date().getMonth(),
  "this summer": () => 5,
  "this winter": () => 11,
  summer: () => 5,
  winter: () => 11,
  fall: () => 8,
  spring: () => 2,
};

export interface SmartSearchResult {
  query: string;
  dest: string | null;
  month: number | null;
  budget: number | null;
  nonstopOnly: boolean;
  interpretation: string;
}

export function parseSmartSearch(query: string): SmartSearchResult {
  const q = query.toLowerCase().trim();
  const result: SmartSearchResult = {
    query,
    dest: null,
    month: null,
    budget: null,
    nonstopOnly: false,
    interpretation: "",
  };

  // Destination: try 3-letter IATA code
  const iataMatch = q.match(/\b([a-z]{3})\b/);
  if (iataMatch) {
    const code = iataMatch[1]!.toUpperCase();
    const found = INTERNATIONAL_AIRPORTS.find((a) => a.iata === code);
    if (found) result.dest = code;
  }

  // Month
  for (const [phrase, fn] of Object.entries(RELATIVE_TIME)) {
    if (q.includes(phrase)) {
      result.month = fn();
      break;
    }
  }
  if (result.month == null) {
    for (const [name, monthIdx] of Object.entries(MONTH_KEYWORDS)) {
      if (new RegExp(`\\b${name}\\b`, "i").test(q)) {
        result.month = monthIdx;
        break;
      }
    }
  }

  // Budget
  const budgetMatch = q.match(/(?:under|below|max|budget|less than)\s*\$?\s*(\d[\d,]*)/);
  if (budgetMatch) {
    result.budget = parseInt(budgetMatch[1]!.replace(/,/g, ""), 10);
  } else {
    const dollarMatch = q.match(/\$(\d[\d,]*)/);
    if (dollarMatch) {
      result.budget = parseInt(dollarMatch[1]!.replace(/,/g, ""), 10);
    }
  }

  // Nonstop
  if (q.includes("nonstop") || q.includes("non-stop") || q.includes("direct")) {
    result.nonstopOnly = true;
  }

  // Build interpretation
  const parts: string[] = ["flights"];
  if (result.dest) parts.push(`to ${result.dest}`);
  if (result.month != null) {
    const names = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    parts.push(`in ${names[result.month]}`);
  }
  if (result.budget != null) parts.push(`under $${result.budget}`);
  if (result.nonstopOnly) parts.push("(nonstop only)");
  result.interpretation = parts.join(" ");

  return result;
}

// ---------------------------------------------------------------------------
// DB-backed flight search (FareCache + FareHistory)
// ---------------------------------------------------------------------------

export interface FlightSearchQuery {
  origin?: string;
  destination?: string;
  month?: number;
  maxPrice?: number;
  limit?: number;
  page?: number;
}

export interface FlightSearchResult {
  id: string;
  origin: string;
  destination: string;
  flyToCode: string;
  month: number;
  outboundDate: string | null;
  returnDate: string | null;
  price: number;
  currency: string;
  airline: string | null;
  source: string | null;
  dealScore: number | null;
  tier: string | null;
  lastSeen: string;
}

export interface FlightSearchResponse {
  results: FlightSearchResult[];
  count: number;
  totalMatched: number;
  page: number;
  pages: number;
}

export async function searchFlights(q: FlightSearchQuery): Promise<FlightSearchResponse> {
  const limit = Math.min(Math.max(q.limit ?? 50, 1), 200);
  const page = Math.max(1, q.page ?? 1);

  const where: Record<string, unknown> = {};
  if (q.origin) where.origin = q.origin.toUpperCase();
  if (q.destination) where.destination = q.destination.toUpperCase();
  if (q.month != null) where.month = q.month;

  const [total, rows] = await Promise.all([
    prisma.fareCache.count({ where }),
    prisma.fareCache.findMany({
      where,
      orderBy: { price: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const results: FlightSearchResult[] = rows
    .filter((r) => q.maxPrice == null || Number(r.price) <= q.maxPrice)
    .map((r) => ({
      id: r.id,
      origin: r.origin,
      destination: r.destination,
      flyToCode: r.flyToCode,
      month: r.month,
      outboundDate: r.outboundDate?.toISOString().slice(0, 10) ?? null,
      returnDate: r.returnDate?.toISOString().slice(0, 10) ?? null,
      price: Number(r.price),
      currency: r.currency,
      airline: r.airline,
      source: r.source,
      dealScore: r.dealScore,
      tier: r.tier,
      lastSeen: r.lastSeen.toISOString(),
    }));

  const pages = Math.max(1, Math.ceil(total / limit));

  return { results, count: results.length, totalMatched: total, page, pages };
}

// ---------------------------------------------------------------------------
// Calendar view — price by departure date for a route
// ---------------------------------------------------------------------------

export interface CalendarPoint {
  date: string;
  price: number;
}

export async function routeCalendar(
  origin: string,
  destination: string,
): Promise<CalendarPoint[]> {
  const rows = await prisma.fareCache.findMany({
    where: {
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      outboundDate: { not: null },
    },
    orderBy: { outboundDate: "asc" },
    select: { outboundDate: true, price: true },
  });

  // Group by date, take min price per date
  const byDate = new Map<string, number>();
  for (const r of rows) {
    if (!r.outboundDate) continue;
    const d = r.outboundDate.toISOString().slice(0, 10);
    const p = Number(r.price);
    const cur = byDate.get(d);
    if (cur == null || p < cur) byDate.set(d, p);
  }

  return [...byDate.entries()]
    .map(([date, price]) => ({ date, price }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Price history for a route (from FareHistory)
// ---------------------------------------------------------------------------

export interface PriceHistoryPoint {
  date: string;
  price: number;
}

export async function routePriceHistory(
  origin: string,
  destination: string,
  days = 90,
): Promise<PriceHistoryPoint[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.fareHistory.findMany({
    where: {
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      recordedAt: { gte: since },
    },
    orderBy: { recordedAt: "asc" },
    select: { recordedAt: true, price: true },
  });

  // Group by day, take min price per day
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const d = r.recordedAt.toISOString().slice(0, 10);
    const p = Number(r.price);
    const cur = byDay.get(d);
    if (cur == null || p < cur) byDay.set(d, p);
  }

  return [...byDay.entries()]
    .map(([date, price]) => ({ date, price }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
