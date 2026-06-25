/**
 * Stub file — all demo data has been removed.
 * Exports empty arrays to avoid breaking imports.
 * Real data comes from APIs and the database only.
 */

import type { LocationItem } from "./types";
import type { CountryDeal, DealRoute } from "@/components/DealsMapPanel";

/** Journal country entry for map display */
export interface JournalCountry {
  countryCode: string;
  name?: string;
}

export const DEMO_LOCATIONS: LocationItem[] = [];
export const DEMO_COUNTRY_DEALS: CountryDeal[] = [];
export const DEMO_JOURNAL_COUNTRIES: JournalCountry[] = [];
export const DEMO_DEAL_ROUTES: DealRoute[] = [];

// ---------------------------------------------------------------------------
// Type exports kept for compatibility (arrays are empty)
// ---------------------------------------------------------------------------

export interface DemoDealItem {
  id: string;
  origin: string;
  destination: string;
  flyToCode: string;
  month: number;
  price: number;
  currency: string;
  airline: string | null;
  source: string | null;
  dealScore: number | null;
  tier: string | null;
  lastSeen: string;
  savingsPercent: number;
  outboundDate: string | null;
  returnDate: string | null;
  transfers?: number | null;
  duration?: number | null;
  deepLink?: string;
  countryTo?: string;
  isAward?: boolean;
  miles?: number;
  program?: string;
  programName?: string;
  cabin?: string;
  cabinLabel?: string;
  tripType?: string;
}

export const DEMO_DEALS: DemoDealItem[] = [];

export interface DemoSearchResult {
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

export const DEMO_SEARCH_RESULTS: DemoSearchResult[] = [];

export interface DemoJournalEntry {
  id: string;
  title: string;
  content: string;
  location: string | null;
  country: string | null;
  date: string | null;
  mood: string | null;
  weather: string | null;
  tags: string[];
  photos: string[];
  tripId: string | null;
  trip?: { id: string; city: string; country: string } | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEMO_JOURNAL_ENTRIES: DemoJournalEntry[] = [];

export interface DemoLoyaltyProgram {
  id: string;
  programName: string;
  programCode: string | null;
  balance: number;
  tier: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

export const DEMO_LOYALTY_PROGRAMS: DemoLoyaltyProgram[] = [];

export interface DemoCard {
  id: string;
  cardName: string;
  issuer: string | null;
  pointsBalance: number;
  annualFee: number | null;
  category: string | null;
  createdAt: string;
}

export const DEMO_CARDS: DemoCard[] = [];

export interface DemoSweetSpot {
  partner: string;
  route: string;
  cabin: string;
  pointsCost: number;
  notes: string;
  airline: string;
}

export const DEMO_SWEET_SPOTS: DemoSweetSpot[] = [];

// ---------------------------------------------------------------------------
// Demo mode detection
// ---------------------------------------------------------------------------

/** Detect if we're running in static/demo mode (no backend API available). */
let _demoMode: boolean | null = null;

export async function isDemoMode(): Promise<boolean> {
  if (_demoMode !== null) return _demoMode;
  try {
    const res = await fetch("/api/auth/me", { method: "GET" });
    _demoMode = !res.ok;
  } catch {
    _demoMode = true;
  }
  return _demoMode;
}

export function getDemoMode(): boolean {
  return _demoMode === true;
}

export function setDemoMode(v: boolean) {
  _demoMode = v;
}
