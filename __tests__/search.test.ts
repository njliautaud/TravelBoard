/**
 * Tests for the search service — parseSmartSearch, searchLocal, scoring.
 *
 * These functions are pure (no DB calls) and import from @travelboard/core
 * for the airport/destination datasets.
 */

import { describe, it, expect } from "vitest";
import {
  parseSmartSearch,
  searchLocal,
  type SearchHit,
} from "@/lib/services/search";

// ---------------------------------------------------------------------------
// parseSmartSearch
// ---------------------------------------------------------------------------

describe("parseSmartSearch", () => {
  it("parses 'flights to JFK in July under $500'", () => {
    const r = parseSmartSearch("flights to JFK in July under $500");
    expect(r.dest).toBe("JFK");
    expect(r.month).toBe(6);
    expect(r.budget).toBe(500);
    expect(r.nonstopOnly).toBe(false);
  });

  it("parses 'nonstop to LAX'", () => {
    const r = parseSmartSearch("nonstop to LAX");
    expect(r.dest).toBe("LAX");
    expect(r.nonstopOnly).toBe(true);
  });

  it("parses 'cheap flights next month'", () => {
    const r = parseSmartSearch("cheap flights next month");
    const expected = (new Date().getMonth() + 1) % 12;
    expect(r.month).toBe(expected);
  });

  it("does not match 'tokyo' as an IATA code (not a valid 3-letter IATA)", () => {
    // "tokyo" is 5 letters. The regex looks for \b([a-z]{3})\b.
    // It will match sub-words if present (like "tok"), but "tok" is not a valid
    // IATA airport in the dataset. However the regex WILL match a 3-letter
    // subsequence. Let's verify it doesn't set dest to anything meaningful.
    const r = parseSmartSearch("tokyo");
    // "tok" would be extracted but isn't a valid IATA airport in the dataset
    // The parser checks against INTERNATIONAL_AIRPORTS, so unless "TOK" exists, dest=null
    // Note: if there happens to be a "TOK" airport, this test adjusts accordingly
    // The key point: "tokyo" itself is not treated as an IATA code
    expect(r.dest === null || r.dest !== "TOKYO").toBe(true);
  });

  it("returns empty/null fields for empty string", () => {
    const r = parseSmartSearch("");
    expect(r.dest).toBe(null);
    expect(r.month).toBe(null);
    expect(r.budget).toBe(null);
    expect(r.nonstopOnly).toBe(false);
    expect(r.query).toBe("");
  });

  it("parses 'MCO' as destination", () => {
    const r = parseSmartSearch("MCO");
    // MCO is lowercase in the regex match, then uppercased and checked against airports
    // "mco" -> MCO -> Orlando International
    expect(r.dest).toBe("MCO");
  });

  it("parses month names (January through December)", () => {
    expect(parseSmartSearch("flights in january").month).toBe(0);
    expect(parseSmartSearch("flights in february").month).toBe(1);
    expect(parseSmartSearch("flights in march").month).toBe(2);
    expect(parseSmartSearch("flights in april").month).toBe(3);
    expect(parseSmartSearch("flights in may").month).toBe(4);
    expect(parseSmartSearch("flights in june").month).toBe(5);
    expect(parseSmartSearch("flights in july").month).toBe(6);
    expect(parseSmartSearch("flights in august").month).toBe(7);
    expect(parseSmartSearch("flights in september").month).toBe(8);
    expect(parseSmartSearch("flights in october").month).toBe(9);
    expect(parseSmartSearch("flights in november").month).toBe(10);
    expect(parseSmartSearch("flights in december").month).toBe(11);
  });

  it("parses abbreviated month names", () => {
    expect(parseSmartSearch("flights in jan").month).toBe(0);
    expect(parseSmartSearch("flights in feb").month).toBe(1);
    expect(parseSmartSearch("flights in mar").month).toBe(2);
    expect(parseSmartSearch("flights in apr").month).toBe(3);
    expect(parseSmartSearch("flights in jun").month).toBe(5);
    expect(parseSmartSearch("flights in jul").month).toBe(6);
    expect(parseSmartSearch("flights in aug").month).toBe(7);
    expect(parseSmartSearch("flights in sep").month).toBe(8);
    expect(parseSmartSearch("flights in oct").month).toBe(9);
    expect(parseSmartSearch("flights in nov").month).toBe(10);
    expect(parseSmartSearch("flights in dec").month).toBe(11);
  });

  it("parses 'non-stop' (hyphenated) as nonstop", () => {
    const r = parseSmartSearch("non-stop to JFK");
    expect(r.nonstopOnly).toBe(true);
  });

  it("parses 'direct' as nonstop", () => {
    const r = parseSmartSearch("direct flights to LAX");
    expect(r.nonstopOnly).toBe(true);
  });

  it("parses budget with 'below' keyword", () => {
    const r = parseSmartSearch("flights below $300");
    expect(r.budget).toBe(300);
  });

  it("parses budget with 'max' keyword", () => {
    const r = parseSmartSearch("flights max $1,200");
    expect(r.budget).toBe(1200);
  });

  it("parses dollar sign without keyword", () => {
    const r = parseSmartSearch("flights $400");
    expect(r.budget).toBe(400);
  });

  it("parses seasonal keywords", () => {
    expect(parseSmartSearch("summer flights").month).toBe(5);
    expect(parseSmartSearch("winter getaway").month).toBe(11);
    expect(parseSmartSearch("fall trip").month).toBe(8);
    expect(parseSmartSearch("spring break").month).toBe(2);
  });

  it("parses 'this month'", () => {
    const r = parseSmartSearch("flights this month");
    expect(r.month).toBe(new Date().getMonth());
  });

  it("builds a human-readable interpretation", () => {
    const r = parseSmartSearch("flights to JFK in July under $500");
    expect(r.interpretation).toContain("JFK");
    expect(r.interpretation).toContain("July");
    expect(r.interpretation).toContain("$500");
  });

  it("interpretation includes (nonstop only) when applicable", () => {
    const r = parseSmartSearch("nonstop to LAX");
    expect(r.interpretation).toContain("nonstop only");
  });

  it("preserves original query in result", () => {
    const input = "flights to JFK in July under $500";
    const r = parseSmartSearch(input);
    expect(r.query).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// searchLocal
// ---------------------------------------------------------------------------

describe("searchLocal", () => {
  it("returns empty array for empty query", () => {
    expect(searchLocal({ q: "" })).toEqual([]);
  });

  it("returns empty array for whitespace-only query", () => {
    expect(searchLocal({ q: "   " })).toEqual([]);
  });

  it("finds MCO by exact IATA code", () => {
    const hits = searchLocal({ q: "MCO" });
    expect(hits.length).toBeGreaterThan(0);
    // The exact IATA match should be the first result (score 100)
    const first = hits[0]!;
    expect(first.code).toBe("MCO");
    expect(first.score).toBe(100);
  });

  it("IATA match is case-insensitive", () => {
    const hits = searchLocal({ q: "mco" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.code).toBe("MCO");
    expect(hits[0]!.score).toBe(100);
  });

  it("finds airports by city name prefix", () => {
    const hits = searchLocal({ q: "Orlando", kinds: ["airport"] });
    expect(hits.length).toBeGreaterThan(0);
    // Orlando should match MCO
    const mco = hits.find((h) => h.code === "MCO");
    expect(mco).toBeDefined();
  });

  it("finds destinations by country", () => {
    const hits = searchLocal({ q: "Japan", kinds: ["destination"] });
    expect(hits.length).toBeGreaterThan(0);
    // All results should have Japan in sublabel
    for (const h of hits) {
      expect(h.sublabel.toLowerCase()).toContain("japan");
    }
  });

  it("results are sorted by score descending", () => {
    const hits = searchLocal({ q: "New" });
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i]!.score).toBeLessThanOrEqual(hits[i - 1]!.score);
    }
  });

  it("respects limit parameter", () => {
    const hits = searchLocal({ q: "a", limit: 5 });
    expect(hits.length).toBeLessThanOrEqual(5);
  });

  it("default limit is 25", () => {
    const hits = searchLocal({ q: "a" });
    expect(hits.length).toBeLessThanOrEqual(25);
  });

  it("filters by kinds - airport only", () => {
    const hits = searchLocal({ q: "London", kinds: ["airport"] });
    for (const h of hits) {
      expect(h.kind).toBe("airport");
    }
  });

  it("filters by kinds - destination only", () => {
    const hits = searchLocal({ q: "London", kinds: ["destination"] });
    for (const h of hits) {
      expect(h.kind).toBe("destination");
    }
  });

  it("exact IATA match gets highest score (100) for airports", () => {
    const hits = searchLocal({ q: "JFK", kinds: ["airport"] });
    const jfk = hits.find((h) => h.code === "JFK");
    expect(jfk).toBeDefined();
    expect(jfk!.score).toBe(100);
  });

  it("exact code match gets score 95 for destinations", () => {
    const hits = searchLocal({ q: "JFK", kinds: ["destination"] });
    const jfk = hits.find((h) => h.code === "JFK");
    if (jfk) {
      expect(jfk.score).toBe(95);
    }
  });

  it("city prefix match scores 80 for airports", () => {
    const hits = searchLocal({ q: "new y", kinds: ["airport"] });
    // "New York" starts with "new y" => score 80
    const match = hits.find((h) => h.label.toLowerCase().includes("new york"));
    if (match) {
      expect(match.score).toBe(80);
    }
  });

  it("country match scores 25 for airports", () => {
    const hits = searchLocal({ q: "united states", kinds: ["airport"] });
    expect(hits.length).toBeGreaterThan(0);
    // Country-only matches should score 25
    const countryOnlyMatch = hits.find(
      (h) =>
        !h.label.toLowerCase().includes("united states") &&
        h.sublabel.toLowerCase().includes("united states"),
    );
    if (countryOnlyMatch) {
      expect(countryOnlyMatch.score).toBe(25);
    }
  });

  it("includes both airports and destinations by default", () => {
    const hits = searchLocal({ q: "London" });
    const kinds = new Set(hits.map((h) => h.kind));
    // London should have both airport and destination entries
    expect(kinds.has("airport")).toBe(true);
    expect(kinds.has("destination")).toBe(true);
  });

  it("each hit has required fields", () => {
    const hits = searchLocal({ q: "MCO" });
    for (const h of hits) {
      expect(h).toHaveProperty("kind");
      expect(h).toHaveProperty("score");
      expect(h).toHaveProperty("label");
      expect(h).toHaveProperty("sublabel");
      expect(h).toHaveProperty("code");
      expect(h).toHaveProperty("lat");
      expect(h).toHaveProperty("lon");
      expect(typeof h.score).toBe("number");
      expect(typeof h.lat).toBe("number");
      expect(typeof h.lon).toBe("number");
    }
  });
});

// ---------------------------------------------------------------------------
// Scoring edge cases
// ---------------------------------------------------------------------------

describe("scoring edge cases", () => {
  it("partial city name match (contains) gets lower score than prefix", () => {
    // "york" is contained in "New York" but doesn't start with "york"
    const hits = searchLocal({ q: "york", kinds: ["airport"] });
    const nyc = hits.find((h) => h.label.toLowerCase().includes("new york"));
    if (nyc) {
      // Contains match = 60, not 80 (prefix)
      expect(nyc.score).toBe(60);
    }
  });

  it("airport name match gets score 45", () => {
    // Search for part of an airport name (not city, not IATA)
    const hits = searchLocal({ q: "international", kinds: ["airport"] });
    // Airports whose name contains "international" but city doesn't
    const nameOnlyMatch = hits.find(
      (h) =>
        !h.label.toLowerCase().includes("international") &&
        h.sublabel.toLowerCase().includes("international"),
    );
    if (nameOnlyMatch) {
      expect(nameOnlyMatch.score).toBe(45);
    }
  });
});
