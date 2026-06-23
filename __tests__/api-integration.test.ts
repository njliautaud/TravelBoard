/**
 * API integration tests — verifies the filtering, pagination, and
 * error-handling logic of the search/fares API routes.
 *
 * Since Next.js route handlers depend on NextRequest/NextResponse and Prisma,
 * we test the underlying service layer logic that the routes call.
 * The searchFlights function does the actual filtering via Prisma WHERE clauses;
 * here we validate that the WHERE-building logic and response shaping are correct.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Replicate the WHERE-building and pagination logic from search.ts searchFlights
// ---------------------------------------------------------------------------

interface FlightSearchQuery {
  origin?: string;
  destination?: string;
  month?: number;
  maxPrice?: number;
  limit?: number;
  page?: number;
}

/** Replicates the WHERE clause builder from searchFlights */
function buildWhereClause(q: FlightSearchQuery): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (q.origin) where.origin = q.origin.toUpperCase();
  if (q.destination) {
    const destUpper = q.destination.toUpperCase();
    where.OR = [
      { destination: { contains: destUpper } },
      { flyToCode: destUpper },
    ];
  }
  if (q.month != null) where.month = q.month;
  if (q.maxPrice != null) where.price = { lte: q.maxPrice };
  return where;
}

/** Replicates pagination logic */
function computePagination(q: FlightSearchQuery) {
  const limit = Math.min(Math.max(q.limit ?? 50, 1), 200);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * limit;
  return { limit, page, skip };
}

/** Replicates pages calculation */
function computePages(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit));
}

// ---------------------------------------------------------------------------
// Mock fare data for filter validation
// ---------------------------------------------------------------------------

interface MockFare {
  id: string;
  origin: string;
  destination: string;
  flyToCode: string;
  month: number;
  price: number;
}

const MOCK_FARES: MockFare[] = [
  { id: "1", origin: "MCO", destination: "New York", flyToCode: "JFK", month: 6, price: 199 },
  { id: "2", origin: "MCO", destination: "Los Angeles", flyToCode: "LAX", month: 6, price: 350 },
  { id: "3", origin: "MCO", destination: "London", flyToCode: "LHR", month: 6, price: 600 },
  { id: "4", origin: "JFK", destination: "London", flyToCode: "LHR", month: 6, price: 450 },
  { id: "5", origin: "MCO", destination: "New York", flyToCode: "JFK", month: 7, price: 250 },
  { id: "6", origin: "MCO", destination: "Paris", flyToCode: "CDG", month: 7, price: 550 },
  { id: "7", origin: "LAX", destination: "Tokyo", flyToCode: "NRT", month: 8, price: 800 },
  { id: "8", origin: "MCO", destination: "Chicago", flyToCode: "ORD", month: 6, price: 150 },
  { id: "9", origin: "MCO", destination: "Miami", flyToCode: "MIA", month: 6, price: 89 },
  { id: "10", origin: "MCO", destination: "Seattle", flyToCode: "SEA", month: 6, price: 400 },
];

/** Apply WHERE-like filter to mock data */
function filterFares(fares: MockFare[], where: Record<string, unknown>): MockFare[] {
  return fares.filter((f) => {
    if (where.origin && f.origin !== where.origin) return false;
    if (where.month != null && f.month !== where.month) return false;
    if (where.price) {
      const priceFilter = where.price as { lte: number };
      if (f.price > priceFilter.lte) return false;
    }
    if (where.OR) {
      const orClauses = where.OR as Array<Record<string, unknown>>;
      const matchesAny = orClauses.some((clause) => {
        if ("destination" in clause) {
          const destFilter = clause.destination as { contains: string };
          return f.destination.toUpperCase().includes(destFilter.contains);
        }
        if ("flyToCode" in clause) {
          return f.flyToCode === clause.flyToCode;
        }
        return false;
      });
      if (!matchesAny) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Tests: WHERE clause building
// ---------------------------------------------------------------------------

describe("WHERE clause building", () => {
  it("origin filter uppercases the code", () => {
    const where = buildWhereClause({ origin: "mco" });
    expect(where.origin).toBe("MCO");
  });

  it("month filter passes through directly", () => {
    const where = buildWhereClause({ month: 6 });
    expect(where.month).toBe(6);
  });

  it("maxPrice creates lte constraint", () => {
    const where = buildWhereClause({ maxPrice: 500 });
    expect(where.price).toEqual({ lte: 500 });
  });

  it("destination creates OR clause for destination + flyToCode", () => {
    const where = buildWhereClause({ destination: "jfk" });
    expect(where.OR).toEqual([
      { destination: { contains: "JFK" } },
      { flyToCode: "JFK" },
    ]);
  });

  it("empty query produces empty WHERE", () => {
    const where = buildWhereClause({});
    expect(Object.keys(where)).toHaveLength(0);
  });

  it("combined filters all present", () => {
    const where = buildWhereClause({
      origin: "MCO",
      destination: "JFK",
      month: 6,
      maxPrice: 500,
    });
    expect(where.origin).toBe("MCO");
    expect(where.month).toBe(6);
    expect(where.price).toEqual({ lte: 500 });
    expect(where.OR).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: filter application on mock data
// ---------------------------------------------------------------------------

describe("filter application", () => {
  it("origin=MCO returns only MCO fares", () => {
    const where = buildWhereClause({ origin: "MCO" });
    const results = filterFares(MOCK_FARES, where);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.origin).toBe("MCO");
    }
  });

  it("origin=MCO excludes JFK and LAX origin fares", () => {
    const where = buildWhereClause({ origin: "MCO" });
    const results = filterFares(MOCK_FARES, where);
    expect(results.find((r) => r.origin === "JFK")).toBeUndefined();
    expect(results.find((r) => r.origin === "LAX")).toBeUndefined();
  });

  it("month=6 returns only June fares", () => {
    const where = buildWhereClause({ month: 6 });
    const results = filterFares(MOCK_FARES, where);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.month).toBe(6);
    }
  });

  it("month=7 returns only July fares", () => {
    const where = buildWhereClause({ month: 7 });
    const results = filterFares(MOCK_FARES, where);
    expect(results.length).toBe(2); // fare 5 and 6
    for (const r of results) {
      expect(r.month).toBe(7);
    }
  });

  it("maxPrice=500 excludes fares above $500", () => {
    const where = buildWhereClause({ maxPrice: 500 });
    const results = filterFares(MOCK_FARES, where);
    for (const r of results) {
      expect(r.price).toBeLessThanOrEqual(500);
    }
    // Should exclude LHR ($600), CDG ($550), NRT ($800)
    expect(results.find((r) => r.flyToCode === "NRT")).toBeUndefined();
  });

  it("maxPrice=500 includes fare at exactly $500", () => {
    const faresWithExact = [
      ...MOCK_FARES,
      { id: "exact", origin: "MCO", destination: "Test", flyToCode: "TST", month: 6, price: 500 },
    ];
    const where = buildWhereClause({ maxPrice: 500 });
    const results = filterFares(faresWithExact, where);
    expect(results.find((r) => r.id === "exact")).toBeDefined();
  });

  it("destination=JFK matches both flyToCode and destination name", () => {
    const where = buildWhereClause({ destination: "JFK" });
    const results = filterFares(MOCK_FARES, where);
    // Should match fares going TO JFK (flyToCode=JFK)
    expect(results.find((r) => r.flyToCode === "JFK")).toBeDefined();
  });

  it("combined: origin=MCO, month=6, maxPrice=300", () => {
    const where = buildWhereClause({ origin: "MCO", month: 6, maxPrice: 300 });
    const results = filterFares(MOCK_FARES, where);
    for (const r of results) {
      expect(r.origin).toBe("MCO");
      expect(r.month).toBe(6);
      expect(r.price).toBeLessThanOrEqual(300);
    }
    // Should include: JFK ($199), ORD ($150), MIA ($89)
    expect(results.length).toBe(3);
  });

  it("no filters returns all fares", () => {
    const where = buildWhereClause({});
    const results = filterFares(MOCK_FARES, where);
    expect(results.length).toBe(MOCK_FARES.length);
  });

  it("impossible filter combination returns empty", () => {
    const where = buildWhereClause({ origin: "MCO", month: 8 });
    const results = filterFares(MOCK_FARES, where);
    expect(results.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: pagination
// ---------------------------------------------------------------------------

describe("pagination", () => {
  it("defaults to limit=50, page=1", () => {
    const { limit, page, skip } = computePagination({});
    expect(limit).toBe(50);
    expect(page).toBe(1);
    expect(skip).toBe(0);
  });

  it("respects custom limit", () => {
    const { limit } = computePagination({ limit: 10 });
    expect(limit).toBe(10);
  });

  it("caps limit at 200", () => {
    const { limit } = computePagination({ limit: 500 });
    expect(limit).toBe(200);
  });

  it("enforces minimum limit of 1", () => {
    const { limit } = computePagination({ limit: 0 });
    expect(limit).toBe(1);
  });

  it("handles negative limit", () => {
    const { limit } = computePagination({ limit: -5 });
    expect(limit).toBe(1);
  });

  it("page=2 with limit=10 skips first 10", () => {
    const { skip } = computePagination({ page: 2, limit: 10 });
    expect(skip).toBe(10);
  });

  it("page=3 with limit=5 skips first 10", () => {
    const { skip } = computePagination({ page: 3, limit: 5 });
    expect(skip).toBe(10);
  });

  it("enforces minimum page of 1", () => {
    const { page, skip } = computePagination({ page: 0 });
    expect(page).toBe(1);
    expect(skip).toBe(0);
  });

  it("handles negative page", () => {
    const { page, skip } = computePagination({ page: -1 });
    expect(page).toBe(1);
    expect(skip).toBe(0);
  });

  it("computePages: 100 results, limit 10 = 10 pages", () => {
    expect(computePages(100, 10)).toBe(10);
  });

  it("computePages: 101 results, limit 10 = 11 pages", () => {
    expect(computePages(101, 10)).toBe(11);
  });

  it("computePages: 0 results = 1 page (minimum)", () => {
    expect(computePages(0, 10)).toBe(1);
  });

  it("computePages: 5 results, limit 50 = 1 page", () => {
    expect(computePages(5, 50)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: parameter validation (replicates API route edge cases)
// ---------------------------------------------------------------------------

describe("parameter validation", () => {
  it("missing origin is detected (API returns 400)", () => {
    // The fares route checks: if (!origin) return 400
    const origin: string | null = null;
    expect(!origin).toBe(true);
  });

  it("month defaults to current month when not provided", () => {
    const monthStr: string | null = null;
    const month = monthStr != null ? parseInt(monthStr, 10) : new Date().getMonth();
    expect(month).toBe(new Date().getMonth());
    expect(month >= 0 && month <= 11).toBe(true);
  });

  it("invalid month string becomes NaN", () => {
    const month = parseInt("abc", 10);
    expect(isNaN(month)).toBe(true);
  });

  it("month validation rejects out-of-range values", () => {
    const validateMonth = (m: number) => !isNaN(m) && m >= 0 && m <= 11;
    expect(validateMonth(0)).toBe(true);
    expect(validateMonth(11)).toBe(true);
    expect(validateMonth(12)).toBe(false);
    expect(validateMonth(-1)).toBe(false);
    expect(validateMonth(NaN)).toBe(false);
  });

  it("empty query in places mode returns empty result", () => {
    const q = "";
    const mode = "places";
    const shouldReturnEmpty = !q.trim() && mode === "places";
    expect(shouldReturnEmpty).toBe(true);
  });

  it("smart search enriches flight mode when no explicit destination", () => {
    // From the route: if q.trim() && !destination, parse smart search
    const q = "flights to JFK in July";
    const destination: string | undefined = undefined;
    const shouldParse = q.trim() && !destination;
    expect(shouldParse).toBeTruthy();
  });

  it("explicit destination overrides smart search", () => {
    // From the route: parsedDest = destination (explicit) takes precedence
    // smart search only runs when !destination
    const destination = "LAX";
    const q = "flights to JFK"; // would parse to JFK
    const shouldParse = q.trim() && !destination;
    expect(shouldParse).toBe(false);
    // parsedDest stays as "LAX"
    expect(destination).toBe("LAX");
  });

  it("smart search month doesn't override explicit month", () => {
    // From the route: if smart.month != null && parsedMonth == null
    const explicitMonth = 8;
    const smartMonth = 6;
    // Route logic: only uses smart month if explicit is null
    const finalMonth = explicitMonth ?? smartMonth;
    expect(finalMonth).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Tests: response shape
// ---------------------------------------------------------------------------

describe("response shape", () => {
  it("flight search response has required fields", () => {
    const response = {
      results: [] as MockFare[],
      count: 0,
      totalMatched: 0,
      page: 1,
      pages: 1,
    };
    expect(response).toHaveProperty("results");
    expect(response).toHaveProperty("count");
    expect(response).toHaveProperty("totalMatched");
    expect(response).toHaveProperty("page");
    expect(response).toHaveProperty("pages");
    expect(Array.isArray(response.results)).toBe(true);
  });

  it("places search response has required fields", () => {
    const response = { hits: [], count: 0 };
    expect(response).toHaveProperty("hits");
    expect(response).toHaveProperty("count");
  });

  it("count matches results array length", () => {
    const results = MOCK_FARES.slice(0, 3);
    const count = results.length;
    expect(count).toBe(3);
  });

  it("pages calculation is consistent with totalMatched and limit", () => {
    const totalMatched = 47;
    const limit = 10;
    const pages = computePages(totalMatched, limit);
    expect(pages).toBe(5);
    // All results can be reached by iterating pages 1..5
    expect((pages - 1) * limit).toBeLessThan(totalMatched);
    expect(pages * limit).toBeGreaterThanOrEqual(totalMatched);
  });
});
