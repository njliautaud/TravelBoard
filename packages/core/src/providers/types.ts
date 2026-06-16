/**
 * The flight-data provider boundary.
 *
 * GOLDEN RULE 1: this interface shape is SACRED. Nothing downstream (cache, endpoints, board, app)
 * should ever know which concrete provider is live. Swapping providers is a single env var.
 *
 * NOTE: `FareQuote` + `FlightProvider` are ported from the prototype's interface. When the canonical
 * `prototype/travelboard.html` is imported, diff this file against it — the shape must match exactly.
 */

/** A single round-trip fare to one destination city. */
export interface FareQuote {
  /** origin IATA, e.g. "MCO" */
  flyFrom: string;
  /** destination IATA */
  flyTo: string;
  cityTo: string;
  countryTo: string;
  lat: number;
  lon: number;
  /** round-trip price, USD */
  price: number;
  /** great-circle distance, miles */
  distance: number;
  /** beach | city | food | nature | ski */
  themes: string[];
  /** booking URL — fares are inspiration, always link out (Golden rule 4) */
  deepLink: string;
  /** ISO timestamp the quote was produced — drives cache freshness */
  fetchedAt: string;
  /** ISO date (yyyy-mm-dd) of the outbound leg — required for weekend / employed-mode filtering */
  departDate?: string;
  /** ISO date (yyyy-mm-dd) of the return leg — used to bound trip length */
  returnDate?: string;
  /** booking gate / aggregator that surfaced this fare (e.g. "Kiwi.com") */
  gate?: string;
  /** fraction below the route's rolling baseline (0.30 = 30% under market). null when no baseline yet. */
  dealScore?: number | null;
  /** the rolling baseline price (USD) used to compute dealScore */
  baseline?: number | null;
  /** seasonal baseline: trimmed median of prices observed in the same calendar month over prior years. null until we have year-over-year data. */
  seasonalBaseline?: number | null;
  /** curated peak-month heuristic backstop (USD). null when not applicable. */
  peakMonthBaseline?: number | null;
  /** blended baseline used for dealScore (max of rolling/seasonal/peak when present). */
  blendedBaseline?: number | null;
  /** true when departDate falls within +/-3 days of a long-weekend-eligible public holiday in countryTo. */
  longWeekend?: boolean;
  /** name of the adjacent holiday (e.g. "Labor Day") when longWeekend is true; null otherwise. */
  nearHoliday?: string | null;
  /** number of stops on the outbound leg (0 = nonstop). null/undefined when the source does not report it. */
  transfers?: number | null;
  /** canonical winning source id for this offer (e.g. "tp-latest", "tp-directions", "kiwi", "amadeus"). */
  source?: string;
  /** every source that independently quoted this destination (multi-source confirmation). */
  sources?: string[];
  /** per-source price map for transparency/debugging (USD). */
  priceBySource?: Record<string, number>;
  /** deal quality: dealScore adjusted for nonstop bonus, transfer penalty, long-weekend bonus and multi-source confirmation. */
  qualityScore?: number | null;
  /**
   * HC #606: reported TOTAL travel minutes for the ROUND TRIP (TP v2 `duration`,
   * gate-to-gate incl. layovers). null/undefined when the source does not report
   * it (e.g. Kiwi one-per-city). NEVER cross-source donated — a duration only
   * describes the itinerary it was priced with.
   */
  durationMin?: number | null;
  /**
   * HC #618 R4 — every figure on the UI must label one-way vs round-trip. Kiwi
   * returns round-trip (outbound + inbound priced together), most fare-aggregator
   * "anywhere" feeds are round-trip, seats.aero verified awards are one-way
   * segments. Defaults to 'round-trip' for cash sources that already pair legs.
   */
  tripType?: 'one-way' | 'round-trip';
}

/** Options for a cheapest-fares query. `month` is 0–11. */
export interface GetCheapestOptions {
  origin: { code: string; lat: number; lon: number };
  /** 0–11 */
  month: number;
  /** optional max round-trip USD */
  budget?: number;
  /** optional region filter (e.g. "europe", "asia") */
  regions?: string[];
  /** optional theme filter (beach/city/food/nature/ski) */
  themes?: string[];
}

/** The swappable fare-data source. Implemented by MockTequilaProvider and TequilaProvider. */
export interface FlightProvider {
  getCheapest(opts: GetCheapestOptions): Promise<FareQuote[]>;
}

/** Live telemetry for a single tracked flight (Live mode). */
export interface FlightTelemetry {
  flight: string;
  status: 'scheduled' | 'enroute' | 'landed' | 'unknown';
  from: { code: string; lat: number; lon: number };
  to: { code: string; lat: number; lon: number };
  /** current aircraft position */
  position: { lat: number; lon: number };
  /** feet */
  altitude: number;
  /** knots */
  speed: number;
  /** 0–1 fraction of the great-circle route completed */
  progress: number;
  /** ISO estimated time of arrival */
  eta: string;
  /** ISO timestamp this telemetry was produced */
  fetchedAt: string;
}

/**
 * The swappable live-tracking source (Live mode). Parallel to FlightProvider; same rule: cache,
 * never hammer per-request. Implemented by MockFlightTracker and (later) AeroAPI/AeroDataBox adapters.
 */
export interface FlightTrackerProvider {
  track(flight: string): Promise<FlightTelemetry>;
}
