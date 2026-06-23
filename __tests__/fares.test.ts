/**
 * Tests for the fares service — pure helper functions.
 *
 * trimmedMedian, rowToCachedFare, and decimalToNumber are private in fares.ts,
 * so we replicate the logic here for testing. This validates the algorithms
 * that the production code relies on.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Replicate pure helpers from fares.ts
// ---------------------------------------------------------------------------

/** Prisma Decimal stand-in for testing */
class FakeDecimal {
  private value: number;
  constructor(v: number) {
    this.value = v;
  }
  toString() {
    return String(this.value);
  }
  valueOf() {
    return this.value;
  }
}

function decimalToNumber(d: unknown): number | null {
  if (d == null) return null;
  return Number(d);
}

function trimmedMedian(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * 0.1);
  const inner = sorted.slice(cut, sorted.length - cut);
  if (!inner.length) return sorted[Math.floor(sorted.length / 2)] ?? null;
  const mid = Math.floor(inner.length / 2);
  if (inner.length % 2 === 0) {
    return Math.round(((inner[mid - 1] ?? 0) + (inner[mid] ?? 0)) / 2);
  }
  return inner[mid] ?? null;
}

interface FareCacheRow {
  id: string;
  origin: string;
  destination: string;
  flyToCode: string;
  month: number;
  outboundDate: Date | null;
  returnDate: Date | null;
  price: FakeDecimal;
  currency: string;
  airline: string | null;
  source: string | null;
  dealScore: number | null;
  tier: string | null;
  lastSeen: Date;
}

function rowToCachedFare(r: FareCacheRow) {
  return {
    id: r.id,
    origin: r.origin,
    destination: r.destination,
    flyToCode: r.flyToCode,
    month: r.month,
    outboundDate: r.outboundDate?.toISOString() ?? null,
    returnDate: r.returnDate?.toISOString() ?? null,
    price: Number(r.price),
    currency: r.currency,
    airline: r.airline,
    source: r.source,
    dealScore: r.dealScore,
    tier: r.tier,
    lastSeen: r.lastSeen.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests: trimmedMedian
// ---------------------------------------------------------------------------

describe("trimmedMedian", () => {
  it("returns null for empty array", () => {
    expect(trimmedMedian([])).toBe(null);
  });

  it("returns the single element for array of length 1", () => {
    expect(trimmedMedian([42])).toBe(42);
  });

  it("returns median for odd-length array", () => {
    expect(trimmedMedian([1, 3, 5])).toBe(3);
  });

  it("returns average of two middle values for even-length array", () => {
    // [1,2,3,4] -> cut=0 -> inner=[1,2,3,4] -> mid=2 -> avg(3,4)/2? No:
    // inner.length=4, even, mid=2, avg(inner[1], inner[2]) = avg(2,3) = 2.5 -> round = 3
    // Wait: mid = Math.floor(4/2) = 2, inner[mid-1]=inner[1]=2, inner[mid]=inner[2]=3
    // avg = (2+3)/2 = 2.5, Math.round(2.5) = 3
    expect(trimmedMedian([1, 2, 3, 4])).toBe(3);
  });

  it("trims 10% from each side for large arrays", () => {
    // 20 elements: cut = Math.floor(20 * 0.1) = 2
    // So we trim 2 from each side
    const values = [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ];
    // inner = [3..18] (16 elements), median of that = avg(10, 11) = 10.5 -> 11
    const result = trimmedMedian(values);
    expect(result).toBe(11);
  });

  it("handles outliers by trimming them", () => {
    // Without trimming: [1, 100, 101, 102, 103, 104, 105, 106, 107, 1000]
    // median would be avg(103, 104) = 103.5
    // With trimming (cut=1): inner = [100, 101, 102, 103, 104, 105, 106, 107]
    // median = avg(103, 104) = 103.5 -> 104
    const values = [1, 100, 101, 102, 103, 104, 105, 106, 107, 1000];
    const result = trimmedMedian(values);
    expect(result).toBe(104);
  });

  it("handles all identical values", () => {
    expect(trimmedMedian([5, 5, 5, 5, 5])).toBe(5);
  });

  it("handles unsorted input (sorts internally)", () => {
    expect(trimmedMedian([5, 1, 3])).toBe(3);
    expect(trimmedMedian([10, 2, 8, 4, 6])).toBe(6);
  });

  it("handles two elements", () => {
    // cut = Math.floor(2 * 0.1) = 0, inner = [1, 2]
    // even: mid=1, avg(inner[0], inner[1]) = avg(1,2) = 1.5 -> 2
    expect(trimmedMedian([1, 2])).toBe(2);
  });

  it("handles negative values", () => {
    expect(trimmedMedian([-5, -3, -1, 0, 2])).toBe(-1);
  });

  it("handles very large arrays with extreme outliers", () => {
    // 100 values: 98 values of 100, plus outliers 1 and 10000
    const values = Array(98).fill(100) as number[];
    values.push(1, 10000);
    const result = trimmedMedian(values);
    // After sorting and trimming 10% from each side, all remaining should be 100
    expect(result).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Tests: decimalToNumber
// ---------------------------------------------------------------------------

describe("decimalToNumber", () => {
  it("returns null for null", () => {
    expect(decimalToNumber(null)).toBe(null);
  });

  it("returns null for undefined", () => {
    expect(decimalToNumber(undefined)).toBe(null);
  });

  it("converts a FakeDecimal to number", () => {
    expect(decimalToNumber(new FakeDecimal(199.99))).toBe(199.99);
  });

  it("converts a regular number", () => {
    expect(decimalToNumber(42)).toBe(42);
  });

  it("converts zero", () => {
    expect(decimalToNumber(new FakeDecimal(0))).toBe(0);
  });

  it("converts negative values", () => {
    expect(decimalToNumber(new FakeDecimal(-50))).toBe(-50);
  });
});

// ---------------------------------------------------------------------------
// Tests: rowToCachedFare
// ---------------------------------------------------------------------------

describe("rowToCachedFare", () => {
  const baseRow: FareCacheRow = {
    id: "fare-001",
    origin: "MCO",
    destination: "New York",
    flyToCode: "JFK",
    month: 6,
    outboundDate: new Date("2026-07-15T00:00:00Z"),
    returnDate: new Date("2026-07-22T00:00:00Z"),
    price: new FakeDecimal(299.99),
    currency: "USD",
    airline: "JetBlue",
    source: "kiwi",
    dealScore: 0.25,
    tier: "fair",
    lastSeen: new Date("2026-06-23T12:00:00Z"),
  };

  it("transforms all fields correctly", () => {
    const fare = rowToCachedFare(baseRow);
    expect(fare.id).toBe("fare-001");
    expect(fare.origin).toBe("MCO");
    expect(fare.destination).toBe("New York");
    expect(fare.flyToCode).toBe("JFK");
    expect(fare.month).toBe(6);
    expect(fare.price).toBe(299.99);
    expect(fare.currency).toBe("USD");
    expect(fare.airline).toBe("JetBlue");
    expect(fare.source).toBe("kiwi");
    expect(fare.dealScore).toBe(0.25);
    expect(fare.tier).toBe("fair");
  });

  it("converts Decimal price to number", () => {
    const fare = rowToCachedFare(baseRow);
    expect(typeof fare.price).toBe("number");
    expect(fare.price).toBe(299.99);
  });

  it("converts Date fields to ISO strings", () => {
    const fare = rowToCachedFare(baseRow);
    expect(fare.outboundDate).toBe("2026-07-15T00:00:00.000Z");
    expect(fare.returnDate).toBe("2026-07-22T00:00:00.000Z");
    expect(fare.lastSeen).toBe("2026-06-23T12:00:00.000Z");
  });

  it("handles null outboundDate", () => {
    const row = { ...baseRow, outboundDate: null };
    const fare = rowToCachedFare(row);
    expect(fare.outboundDate).toBe(null);
  });

  it("handles null returnDate", () => {
    const row = { ...baseRow, returnDate: null };
    const fare = rowToCachedFare(row);
    expect(fare.returnDate).toBe(null);
  });

  it("handles null airline", () => {
    const row = { ...baseRow, airline: null };
    const fare = rowToCachedFare(row);
    expect(fare.airline).toBe(null);
  });

  it("handles null source", () => {
    const row = { ...baseRow, source: null };
    const fare = rowToCachedFare(row);
    expect(fare.source).toBe(null);
  });

  it("handles null dealScore", () => {
    const row = { ...baseRow, dealScore: null };
    const fare = rowToCachedFare(row);
    expect(fare.dealScore).toBe(null);
  });

  it("handles null tier", () => {
    const row = { ...baseRow, tier: null };
    const fare = rowToCachedFare(row);
    expect(fare.tier).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// Tests: deal scoring / tiering logic
// ---------------------------------------------------------------------------

describe("deal scoring logic", () => {
  function computeDealScore(
    price: number,
    baseline: number | null,
  ): number | null {
    if (baseline == null || baseline <= 0) return null;
    return Math.round(((baseline - price) / baseline) * 1000) / 1000;
  }

  function computeTier(dealScore: number | null): string | null {
    if (dealScore == null) return null;
    if (dealScore >= 0.3) return "cheap";
    if (dealScore >= 0.1) return "fair";
    return "splurge";
  }

  it("30%+ savings = 'cheap' tier", () => {
    const score = computeDealScore(70, 100);
    expect(score).toBe(0.3);
    expect(computeTier(score)).toBe("cheap");
  });

  it("50% savings = 'cheap' tier", () => {
    const score = computeDealScore(50, 100);
    expect(score).toBe(0.5);
    expect(computeTier(score)).toBe("cheap");
  });

  it("15% savings = 'fair' tier", () => {
    const score = computeDealScore(85, 100);
    expect(score).toBe(0.15);
    expect(computeTier(score)).toBe("fair");
  });

  it("5% savings = 'splurge' tier", () => {
    const score = computeDealScore(95, 100);
    expect(score).toBe(0.05);
    expect(computeTier(score)).toBe("splurge");
  });

  it("negative savings (price above baseline) = 'splurge'", () => {
    const score = computeDealScore(120, 100);
    expect(score).toBe(-0.2);
    expect(computeTier(score)).toBe("splurge");
  });

  it("null baseline = null score and null tier", () => {
    expect(computeDealScore(100, null)).toBe(null);
    expect(computeTier(null)).toBe(null);
  });

  it("zero baseline = null score", () => {
    expect(computeDealScore(100, 0)).toBe(null);
  });
});
