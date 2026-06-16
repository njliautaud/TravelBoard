/** Domain types shared across api, board, and mobile. */

export type Theme = 'beach' | 'city' | 'food' | 'nature' | 'ski';

export type Region =
  | 'north-america'
  | 'south-america'
  | 'europe'
  | 'africa'
  | 'middle-east'
  | 'asia'
  | 'oceania';

export interface GeoPoint {
  lat: number;
  lon: number;
}

/** An airport the user can fly *from*. */
export interface Airport {
  code: string; // IATA
  city: string;
  country: string;
  lat: number;
  lon: number;
}

/** A candidate destination in the dataset. */
export interface Destination {
  code: string; // IATA
  city: string;
  country: string;
  region: Region;
  lat: number;
  lon: number;
  themes: Theme[];
  /** Hemisphere-driven peak-travel month (0–11); fares ride a seasonal sine around it. */
  peakMonth: number;
}

/** Fare affordability tiers (drive the board's teal/amber/coral tint). */
export type FareTier = 'cheap' | 'fair' | 'splurge';

/** A FareQuote annotated with its tier and whether it's a haloed best-deal. */
export interface TieredFare {
  tier: FareTier;
  /** true → halo + price tag on the board */
  isBestDeal: boolean;
}

/** A visited place on the Memory map. */
export interface Trip {
  code: string; // destination IATA
  city: string;
  country: string;
  lat: number;
  lon: number;
  /** ISO date visited */
  date: string;
  note?: string;
}

/** Aggregate lifetime stats for the Memory map. */
export interface TravelStats {
  countries: number;
  continents: number;
  miles: number;
  trips: number;
}

/** A price-watch entry: glow this destination when a fare drops below target. */
export interface Watch {
  code: string; // destination IATA
  origin: string; // origin IATA
  targetPrice: number;
  createdAt: string;
}

export type BoardMode = 'discovery' | 'memory' | 'live' | 'ambient';

/**
 * Shared board state — the phone writes it, the board reads it. Deliberately simple (the pairing
 * transport is a thin abstraction over backend state for now).
 */
export interface BoardState {
  mode: BoardMode;
  origin: string; // home airport IATA
  month: number; // 0–11
  budget: number; // USD
  themes: Theme[];
  regions: Region[];
  /** destination IATA the phone pushed to highlight, if any */
  pushedDeal: string | null;
  /** flight number being tracked in Live mode, if any */
  trackedFlight: string | null;
  /** time-of-day → mode schedule for Ambient (hour 0–23 → mode) */
  schedule: Record<string, BoardMode>;
  updatedAt: string;
}
