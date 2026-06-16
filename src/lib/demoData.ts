/**
 * Demo data for the static Cloudflare Pages deployment.
 * When API calls fail (no backend), the app falls back to this data
 * so users can see the full experience.
 */

import type { LocationItem } from "./types";
import type { CountryDeal, JournalCountry, DealRoute } from "@/components/TravelMap";

export const DEMO_LOCATIONS: LocationItem[] = [
  {
    id: "demo-1",
    activityName: "Cherry Blossom Season",
    countryCode: "JPN",
    countryName: "Japan",
    region: "Asia",
    city: "Tokyo",
    latitude: 35.6762,
    longitude: 139.6503,
    status: "TO_VISIT",
    notes: "Visit Shinjuku Gyoen during sakura season (late March – early April)",
    reminderAt: null,
    priceThreshold: 800,
    starred: true,
    coverImageUrl: null,
    seasonSpring: true,
    seasonSummer: false,
    seasonFall: false,
    seasonWinter: false,
    media: [],
    latestPrice: { price: 742, currency: "USD", origin: "JFK", destination: "NRT", fetchedAt: new Date().toISOString() },
    isDeal: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "demo-2",
    activityName: "Amalfi Coast Road Trip",
    countryCode: "ITA",
    countryName: "Italy",
    region: "Europe",
    city: "Positano",
    latitude: 40.6281,
    longitude: 14.485,
    status: "TO_VISIT",
    notes: "Drive from Naples to Positano, stop in Ravello for sunset",
    reminderAt: null,
    priceThreshold: 600,
    starred: true,
    coverImageUrl: null,
    seasonSpring: true,
    seasonSummer: true,
    seasonFall: true,
    seasonWinter: false,
    media: [],
    latestPrice: { price: 489, currency: "USD", origin: "JFK", destination: "NAP", fetchedAt: new Date().toISOString() },
    isDeal: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "demo-3",
    activityName: "Northern Lights",
    countryCode: "ISL",
    countryName: "Iceland",
    region: "Europe",
    city: "Reykjavik",
    latitude: 64.1466,
    longitude: -21.9426,
    status: "TO_VISIT",
    notes: "Best September–March. Golden Circle + ice caves",
    reminderAt: null,
    priceThreshold: 500,
    starred: false,
    coverImageUrl: null,
    seasonSpring: false,
    seasonSummer: false,
    seasonFall: true,
    seasonWinter: true,
    media: [],
    latestPrice: { price: 385, currency: "USD", origin: "JFK", destination: "KEF", fetchedAt: new Date().toISOString() },
    isDeal: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "demo-4",
    activityName: "Bali Temples & Rice Terraces",
    countryCode: "IDN",
    countryName: "Indonesia",
    region: "Asia",
    city: "Ubud",
    latitude: -8.5069,
    longitude: 115.2625,
    status: "TO_VISIT",
    notes: "Tegallalang rice terraces, Tirta Empul temple, monkey forest",
    reminderAt: null,
    priceThreshold: 700,
    starred: false,
    coverImageUrl: null,
    seasonSpring: true,
    seasonSummer: true,
    seasonFall: false,
    seasonWinter: false,
    media: [],
    latestPrice: null,
    isDeal: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "demo-5",
    activityName: "Patagonia Trek",
    countryCode: "ARG",
    countryName: "Argentina",
    region: "South America",
    city: "El Chaltén",
    latitude: -49.3315,
    longitude: -72.8865,
    status: "TO_VISIT",
    notes: "W Trek or O Circuit in Torres del Paine",
    reminderAt: null,
    priceThreshold: 900,
    starred: true,
    coverImageUrl: null,
    seasonSpring: false,
    seasonSummer: false,
    seasonFall: false,
    seasonWinter: true,
    media: [],
    latestPrice: { price: 823, currency: "USD", origin: "JFK", destination: "EZE", fetchedAt: new Date().toISOString() },
    isDeal: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "demo-6",
    activityName: "Marrakech Medina",
    countryCode: "MAR",
    countryName: "Morocco",
    region: "Africa",
    city: "Marrakech",
    latitude: 31.6295,
    longitude: -7.9811,
    status: "VISITED",
    notes: "Jemaa el-Fnaa square, riads, Atlas Mountains day trip",
    reminderAt: null,
    priceThreshold: null,
    starred: false,
    coverImageUrl: null,
    seasonSpring: true,
    seasonSummer: false,
    seasonFall: true,
    seasonWinter: false,
    media: [],
    latestPrice: null,
    isDeal: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "demo-7",
    activityName: "Great Barrier Reef Dive",
    countryCode: "AUS",
    countryName: "Australia",
    region: "Oceania",
    city: "Cairns",
    latitude: -16.9186,
    longitude: 145.7781,
    status: "TO_VISIT",
    notes: "Outer reef liveaboard, snorkel with manta rays",
    reminderAt: null,
    priceThreshold: 1100,
    starred: false,
    coverImageUrl: null,
    seasonSpring: false,
    seasonSummer: false,
    seasonFall: false,
    seasonWinter: true,
    media: [],
    latestPrice: null,
    isDeal: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const DEMO_COUNTRY_DEALS: CountryDeal[] = [
  { countryCode: "JPN", cheapestPrice: 542, tier: "cheap" },
  { countryCode: "ITA", cheapestPrice: 389, tier: "cheap" },
  { countryCode: "ISL", cheapestPrice: 285, tier: "cheap" },
  { countryCode: "GRC", cheapestPrice: 445, tier: "fair" },
  { countryCode: "THA", cheapestPrice: 620, tier: "fair" },
  { countryCode: "PRT", cheapestPrice: 340, tier: "cheap" },
  { countryCode: "MEX", cheapestPrice: 210, tier: "cheap" },
  { countryCode: "COL", cheapestPrice: 280, tier: "cheap" },
  { countryCode: "ESP", cheapestPrice: 410, tier: "fair" },
  { countryCode: "NZL", cheapestPrice: 890, tier: "splurge" },
];

export const DEMO_JOURNAL_COUNTRIES: JournalCountry[] = [
  { country: "Morocco", countryCode: "MAR", entryCount: 3, lat: 31.63, lon: -7.98 },
  { country: "Italy", countryCode: "ITA", entryCount: 5, lat: 41.87, lon: 12.57 },
  { country: "Japan", countryCode: "JPN", entryCount: 2, lat: 35.68, lon: 139.65 },
];

export const DEMO_DEAL_ROUTES: DealRoute[] = [
  {
    origin: "JFK", destination: "NRT", destCity: "Tokyo",
    price: 542, dealScore: 92, tier: "cheap",
    originLat: 40.6413, originLon: -73.7781,
    destLat: 35.7647, destLon: 140.3864,
  },
  {
    origin: "JFK", destination: "NAP", destCity: "Naples",
    price: 389, dealScore: 88, tier: "cheap",
    originLat: 40.6413, originLon: -73.7781,
    destLat: 40.886, destLon: 14.2908,
  },
  {
    origin: "JFK", destination: "KEF", destCity: "Reykjavik",
    price: 285, dealScore: 95, tier: "cheap",
    originLat: 40.6413, originLon: -73.7781,
    destLat: 63.985, destLon: -22.6056,
  },
  {
    origin: "JFK", destination: "LIS", destCity: "Lisbon",
    price: 340, dealScore: 90, tier: "cheap",
    originLat: 40.6413, originLon: -73.7781,
    destLat: 38.7756, destLon: -9.1354,
  },
  {
    origin: "JFK", destination: "CUN", destCity: "Cancún",
    price: 210, dealScore: 85, tier: "cheap",
    originLat: 40.6413, originLon: -73.7781,
    destLat: 21.0368, destLon: -86.8774,
  },
  {
    origin: "JFK", destination: "BCN", destCity: "Barcelona",
    price: 410, dealScore: 78, tier: "fair",
    originLat: 40.6413, originLon: -73.7781,
    destLat: 41.2971, destLon: 2.0785,
  },
  {
    origin: "JFK", destination: "BOG", destCity: "Bogotá",
    price: 280, dealScore: 82, tier: "cheap",
    originLat: 40.6413, originLon: -73.7781,
    destLat: 4.7016, destLon: -74.1469,
  },
];

// ---------------------------------------------------------------------------
// Demo deal items for the DealsView in static mode
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

const now = new Date().toISOString();

export const DEMO_DEALS: DemoDealItem[] = [
  {
    id: "demo-deal-1", origin: "MCO", destination: "Reykjavik", flyToCode: "KEF",
    month: 8, price: 285, currency: "USD", airline: "Icelandair", source: "seats.aero",
    dealScore: 95, tier: "cheap", lastSeen: now, savingsPercent: 42,
    outboundDate: "2026-09-12", returnDate: "2026-09-19",
    transfers: 0, duration: 620, countryTo: "Iceland",
  },
  {
    id: "demo-deal-2", origin: "MCO", destination: "Lisbon", flyToCode: "LIS",
    month: 9, price: 340, currency: "USD", airline: "TAP Portugal", source: "Kiwi",
    dealScore: 90, tier: "cheap", lastSeen: now, savingsPercent: 38,
    outboundDate: "2026-10-05", returnDate: "2026-10-14",
    transfers: 0, duration: 890, countryTo: "Portugal",
  },
  {
    id: "demo-deal-3", origin: "MCO", destination: "Cancun", flyToCode: "CUN",
    month: 10, price: 148, currency: "USD", airline: "Spirit", source: "Kiwi",
    dealScore: 88, tier: "cheap", lastSeen: now, savingsPercent: 55,
    outboundDate: "2026-11-02", returnDate: "2026-11-09",
    transfers: 0, duration: 210, countryTo: "Mexico",
  },
  {
    id: "demo-deal-4", origin: "MCO", destination: "Tokyo Narita", flyToCode: "NRT",
    month: 2, price: 542, currency: "USD", airline: "United", source: "seats.aero",
    dealScore: 92, tier: "cheap", lastSeen: now, savingsPercent: 45,
    outboundDate: "2027-03-15", returnDate: "2027-03-28",
    transfers: 1, duration: 1680, countryTo: "Japan",
  },
  {
    id: "demo-deal-5", origin: "MCO", destination: "Barcelona", flyToCode: "BCN",
    month: 4, price: 410, currency: "USD", airline: "Norse Atlantic", source: "Kiwi",
    dealScore: 78, tier: "fair", lastSeen: now, savingsPercent: 22,
    outboundDate: "2027-05-10", returnDate: "2027-05-20",
    transfers: 1, duration: 1020, countryTo: "Spain",
  },
  {
    id: "demo-deal-6", origin: "MCO", destination: "Naples", flyToCode: "NAP",
    month: 5, price: 389, currency: "USD", airline: "Eurowings", source: "seats.aero",
    dealScore: 88, tier: "cheap", lastSeen: now, savingsPercent: 35,
    outboundDate: "2027-06-01", returnDate: "2027-06-10",
    transfers: 1, duration: 1100, countryTo: "Italy",
  },
  {
    id: "demo-deal-7", origin: "MCO", destination: "Bogota", flyToCode: "BOG",
    month: 7, price: 198, currency: "USD", airline: "Avianca", source: "Kiwi",
    dealScore: 82, tier: "cheap", lastSeen: now, savingsPercent: 48,
    outboundDate: "2026-08-20", returnDate: "2026-08-30",
    transfers: 0, duration: 380, countryTo: "Colombia",
  },
  {
    id: "demo-deal-8", origin: "MCO", destination: "Athens", flyToCode: "ATH",
    month: 3, price: 445, currency: "USD", airline: "Delta", source: "seats.aero",
    dealScore: 80, tier: "fair", lastSeen: now, savingsPercent: 28,
    outboundDate: "2027-04-05", returnDate: "2027-04-15",
    transfers: 1, duration: 1340, countryTo: "Greece",
  },
  {
    id: "demo-deal-award-1", origin: "MCO", destination: "Tokyo Haneda", flyToCode: "HND",
    month: 3, price: 0, currency: "USD", airline: "ANA", source: "seats.aero",
    dealScore: 98, tier: "cheap", lastSeen: now, savingsPercent: 0,
    outboundDate: "2027-04-01", returnDate: "2027-04-14",
    transfers: 0, duration: 1580, countryTo: "Japan",
    isAward: true, miles: 55000, program: "VS", programName: "Virgin Atlantic", cabin: "J", cabinLabel: "Business", tripType: "Round Trip",
  },
  {
    id: "demo-deal-award-2", origin: "MCO", destination: "London Heathrow", flyToCode: "LHR",
    month: 9, price: 0, currency: "USD", airline: "British Airways", source: "seats.aero",
    dealScore: 94, tier: "cheap", lastSeen: now, savingsPercent: 0,
    outboundDate: "2026-10-18", returnDate: "2026-10-28",
    transfers: 0, duration: 960, countryTo: "United Kingdom",
    isAward: true, miles: 40000, program: "BA", programName: "British Airways Avios", cabin: "W", cabinLabel: "Premium Economy", tripType: "Round Trip",
  },
];

// ---------------------------------------------------------------------------
// Demo search results for the SearchView in static mode
// ---------------------------------------------------------------------------

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

export const DEMO_SEARCH_RESULTS: DemoSearchResult[] = [
  { id: "ds-1", origin: "MCO", destination: "Reykjavik", flyToCode: "KEF", month: 8, outboundDate: "2026-09-12", returnDate: "2026-09-19", price: 285, currency: "USD", airline: "Icelandair", source: "seats.aero", dealScore: 0.95, tier: "cheap", lastSeen: now },
  { id: "ds-2", origin: "MCO", destination: "Cancun", flyToCode: "CUN", month: 10, outboundDate: "2026-11-02", returnDate: "2026-11-09", price: 148, currency: "USD", airline: "Spirit", source: "Kiwi", dealScore: 0.88, tier: "cheap", lastSeen: now },
  { id: "ds-3", origin: "MCO", destination: "Lisbon", flyToCode: "LIS", month: 9, outboundDate: "2026-10-05", returnDate: "2026-10-14", price: 340, currency: "USD", airline: "TAP Portugal", source: "Kiwi", dealScore: 0.90, tier: "cheap", lastSeen: now },
  { id: "ds-4", origin: "MCO", destination: "Naples", flyToCode: "NAP", month: 5, outboundDate: "2027-06-01", returnDate: "2027-06-10", price: 389, currency: "USD", airline: "Eurowings", source: "seats.aero", dealScore: 0.85, tier: "cheap", lastSeen: now },
  { id: "ds-5", origin: "MCO", destination: "Bogota", flyToCode: "BOG", month: 7, outboundDate: "2026-08-20", returnDate: "2026-08-30", price: 198, currency: "USD", airline: "Avianca", source: "Kiwi", dealScore: 0.82, tier: "cheap", lastSeen: now },
];

// ---------------------------------------------------------------------------
// Demo journal entries for the JournalView in static mode
// ---------------------------------------------------------------------------

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

export const DEMO_JOURNAL_ENTRIES: DemoJournalEntry[] = [
  {
    id: "dj-1", title: "Sunset over the Medina", content: "Watched the sun set from a rooftop riad in Marrakech. The call to prayer echoing across the city as the sky turned from gold to violet was unforgettable. We had mint tea and pastilla while the city lights began to twinkle below.",
    location: "Marrakech Medina", country: "Morocco", date: "2025-11-15", mood: "inspired", weather: "sunny",
    tags: ["sunset", "culture", "food"], photos: [], tripId: null, isPublic: true,
    createdAt: "2025-11-15T18:00:00Z", updatedAt: "2025-11-15T18:00:00Z",
  },
  {
    id: "dj-2", title: "Roman Holiday", content: "Spent the day wandering through the Colosseum and Roman Forum. The scale of ancient Rome is hard to grasp until you're standing in the middle of it. Ended with the best cacio e pepe at a tiny trattoria near Trastevere.",
    location: "Rome", country: "Italy", date: "2026-03-22", mood: "adventurous", weather: "cloudy",
    tags: ["history", "food", "architecture"], photos: [], tripId: null, isPublic: false,
    createdAt: "2026-03-22T20:00:00Z", updatedAt: "2026-03-22T20:00:00Z",
  },
  {
    id: "dj-3", title: "Shibuya at Night", content: "Tokyo's energy is unlike anywhere else. Shibuya crossing at night with all the neon reflecting off wet pavement after a light rain -- pure cyberpunk. Found an incredible ramen spot down a back alley that seated maybe 8 people.",
    location: "Shibuya, Tokyo", country: "Japan", date: "2026-01-08", mood: "excited", weather: "rainy",
    tags: ["nightlife", "food", "city"], photos: [], tripId: null, isPublic: true,
    createdAt: "2026-01-08T22:00:00Z", updatedAt: "2026-01-08T22:00:00Z",
  },
];

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
