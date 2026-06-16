/**
 * Lounge finder service — airport lounge search and details.
 *
 * Adapted from Meridian's lounge-finder.ts. Static curated dataset of
 * major airport lounges with filtering by airport, access method, amenities,
 * and day pass price.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AccessMethod =
  | "priority_pass"
  | "lounge_key"
  | "amex_centurion"
  | "airline_status"
  | "day_pass"
  | "credit_card";

export interface Lounge {
  id: string;
  name: string;
  airport: string;
  terminal: string;
  location: string;
  accessMethods: AccessMethod[];
  creditCards: string[];
  amenities: string[];
  rating: number;
  reviewCount: number;
  hours: string;
  dayPassPrice: number | null;
  imageUrl: string | null;
  highlights: string[];
}

export interface LoungeSearchResult {
  lounges: Array<Lounge & { userHasAccess: boolean }>;
  totalCount: number;
  airport: string;
}

export interface LoungeSearchOptions {
  amenities?: string[];
  accessMethods?: AccessMethod[];
  maxDayPassPrice?: number;
}

// ---------------------------------------------------------------------------
// Curated lounge dataset
// ---------------------------------------------------------------------------

const LOUNGES: Lounge[] = [
  // ATL
  { id: "atl-sky-f", name: "Delta Sky Club - Concourse F", airport: "ATL", terminal: "F", location: "Near Gate F8", accessMethods: ["credit_card", "airline_status", "day_pass"], creditCards: ["amex_delta_reserve", "amex_delta_plat"], amenities: ["wifi", "food", "bar", "showers", "charging"], rating: 4.2, reviewCount: 1840, hours: "05:00-23:00", dayPassPrice: 45, imageUrl: null, highlights: ["Sky Deck outdoor terrace", "Full bar with craft cocktails"] },
  { id: "atl-centurion", name: "The Centurion Lounge", airport: "ATL", terminal: "E", location: "Near Gate E2", accessMethods: ["amex_centurion", "credit_card"], creditCards: ["amex_platinum", "amex_centurion"], amenities: ["wifi", "food", "bar", "showers", "spa"], rating: 4.7, reviewCount: 2100, hours: "05:30-22:00", dayPassPrice: null, imageUrl: null, highlights: ["Complimentary spa treatments", "Chef-curated dining"] },
  { id: "atl-club", name: "The Club ATL", airport: "ATL", terminal: "T", location: "Domestic terminal", accessMethods: ["priority_pass", "lounge_key", "day_pass"], creditCards: [], amenities: ["wifi", "food", "bar", "charging"], rating: 3.5, reviewCount: 420, hours: "06:00-21:00", dayPassPrice: 40, imageUrl: null, highlights: ["Priority Pass access"] },
  // JFK
  { id: "jfk-centurion", name: "The Centurion Lounge", airport: "JFK", terminal: "4", location: "Near Gate B22", accessMethods: ["amex_centurion", "credit_card"], creditCards: ["amex_platinum", "amex_centurion"], amenities: ["wifi", "food", "bar", "showers", "spa", "nap_pods"], rating: 4.8, reviewCount: 3200, hours: "06:00-23:00", dayPassPrice: null, imageUrl: null, highlights: ["Equinox Body Lab", "Cocktail bar by Jim Meehan"] },
  { id: "jfk-turk-biz", name: "Turkish Airlines Lounge", airport: "JFK", terminal: "1", location: "Departures level", accessMethods: ["airline_status", "priority_pass"], creditCards: [], amenities: ["wifi", "food", "bar", "showers", "game_room", "nap_pods"], rating: 4.6, reviewCount: 1500, hours: "07:00-23:00", dayPassPrice: 60, imageUrl: null, highlights: ["Golf simulator", "Turkish cuisine buffet"] },
  { id: "jfk-admirals", name: "Admirals Club", airport: "JFK", terminal: "8", location: "Near Gate 12", accessMethods: ["credit_card", "airline_status", "day_pass"], creditCards: ["citi_aadvantage_exec"], amenities: ["wifi", "food", "bar", "charging"], rating: 3.8, reviewCount: 890, hours: "05:00-23:00", dayPassPrice: 65, imageUrl: null, highlights: ["Flagship First Dining nearby"] },
  // LAX
  { id: "lax-star-alliance", name: "Star Alliance Lounge", airport: "LAX", terminal: "TBIT", location: "Tom Bradley Int'l Terminal", accessMethods: ["airline_status", "priority_pass"], creditCards: [], amenities: ["wifi", "food", "bar", "showers", "nap_pods"], rating: 4.4, reviewCount: 1200, hours: "06:00-01:00", dayPassPrice: null, imageUrl: null, highlights: ["Floor-to-ceiling runway views"] },
  { id: "lax-centurion", name: "The Centurion Lounge", airport: "LAX", terminal: "TBIT", location: "Great Hall", accessMethods: ["amex_centurion", "credit_card"], creditCards: ["amex_platinum", "amex_centurion"], amenities: ["wifi", "food", "bar", "showers", "spa"], rating: 4.6, reviewCount: 2800, hours: "06:00-23:00", dayPassPrice: null, imageUrl: null, highlights: ["Partnership with local chefs"] },
  // ORD
  { id: "ord-united-polaris", name: "United Polaris Lounge", airport: "ORD", terminal: "1", location: "Concourse C", accessMethods: ["airline_status"], creditCards: [], amenities: ["wifi", "food", "bar", "showers", "nap_pods", "dining"], rating: 4.9, reviewCount: 1600, hours: "05:30-22:00", dayPassPrice: null, imageUrl: null, highlights: ["A la carte dining", "Individual daybeds"] },
  { id: "ord-centurion", name: "The Centurion Lounge", airport: "ORD", terminal: "3", location: "Concourse K", accessMethods: ["amex_centurion", "credit_card"], creditCards: ["amex_platinum", "amex_centurion"], amenities: ["wifi", "food", "bar", "showers", "spa"], rating: 4.5, reviewCount: 1900, hours: "06:00-22:00", dayPassPrice: null, imageUrl: null, highlights: ["Partnership with Soho House"] },
  // DFW
  { id: "dfw-centurion", name: "The Centurion Lounge", airport: "DFW", terminal: "D", location: "Near Gate D12", accessMethods: ["amex_centurion", "credit_card"], creditCards: ["amex_platinum", "amex_centurion"], amenities: ["wifi", "food", "bar", "showers", "spa"], rating: 4.5, reviewCount: 1400, hours: "05:30-22:00", dayPassPrice: null, imageUrl: null, highlights: ["Texas BBQ station"] },
  { id: "dfw-admirals", name: "Admirals Club", airport: "DFW", terminal: "C", location: "Between C6-C8", accessMethods: ["credit_card", "airline_status", "day_pass"], creditCards: ["citi_aadvantage_exec"], amenities: ["wifi", "food", "bar", "charging"], rating: 3.6, reviewCount: 600, hours: "05:00-23:00", dayPassPrice: 65, imageUrl: null, highlights: ["Spacious seating"] },
  // SFO
  { id: "sfo-centurion", name: "The Centurion Lounge", airport: "SFO", terminal: "3", location: "Near Gate F2", accessMethods: ["amex_centurion", "credit_card"], creditCards: ["amex_platinum", "amex_centurion"], amenities: ["wifi", "food", "bar", "showers", "spa"], rating: 4.6, reviewCount: 2200, hours: "06:00-22:00", dayPassPrice: null, imageUrl: null, highlights: ["Bay views", "Craft cocktails"] },
  { id: "sfo-united-club", name: "United Club", airport: "SFO", terminal: "3", location: "Concourse E", accessMethods: ["credit_card", "airline_status", "day_pass"], creditCards: ["chase_united_club"], amenities: ["wifi", "food", "bar", "charging"], rating: 3.9, reviewCount: 950, hours: "05:00-23:00", dayPassPrice: 59, imageUrl: null, highlights: ["Fresh-squeezed juices"] },
  // International
  { id: "lhr-virgin", name: "Virgin Atlantic Clubhouse", airport: "LHR", terminal: "3", location: "Upper level, after security", accessMethods: ["airline_status", "day_pass"], creditCards: [], amenities: ["wifi", "food", "bar", "showers", "spa", "game_room"], rating: 4.8, reviewCount: 3400, hours: "05:00-22:00", dayPassPrice: 80, imageUrl: null, highlights: ["Rooftop terrace", "Full spa", "Pool table"] },
  { id: "sin-jewel", name: "Changi Lounge", airport: "SIN", terminal: "Jewel", location: "Jewel Changi Airport L1", accessMethods: ["priority_pass", "day_pass"], creditCards: [], amenities: ["wifi", "food", "showers", "nap_pods", "charging"], rating: 4.3, reviewCount: 800, hours: "24/7", dayPassPrice: 35, imageUrl: null, highlights: ["24/7 access", "Views of Rain Vortex"] },
  { id: "doh-al-mourjan", name: "Al Mourjan Business Lounge", airport: "DOH", terminal: "Main", location: "After immigration", accessMethods: ["airline_status"], creditCards: [], amenities: ["wifi", "food", "bar", "showers", "nap_pods", "game_room", "dining"], rating: 4.9, reviewCount: 2600, hours: "24/7", dayPassPrice: null, imageUrl: null, highlights: ["Water feature", "Middle Eastern fine dining"] },
  { id: "hkg-cathay", name: "Cathay Pacific The Pier", airport: "HKG", terminal: "1", location: "Level 6, near Gate 65", accessMethods: ["airline_status"], creditCards: [], amenities: ["wifi", "food", "bar", "showers", "nap_pods"], rating: 4.7, reviewCount: 1800, hours: "05:30-00:30", dayPassPrice: null, imageUrl: null, highlights: ["The Noodle Bar", "Day suites"] },
  { id: "icn-asiana", name: "Asiana Lounge", airport: "ICN", terminal: "1", location: "East Wing, 4th floor", accessMethods: ["airline_status", "priority_pass"], creditCards: [], amenities: ["wifi", "food", "bar", "showers", "nap_pods"], rating: 4.2, reviewCount: 600, hours: "06:00-22:00", dayPassPrice: 50, imageUrl: null, highlights: ["Korean BBQ station"] },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function findLounges(airport: string, opts?: LoungeSearchOptions): LoungeSearchResult {
  const code = airport.toUpperCase().trim();
  let results = LOUNGES.filter((l) => l.airport === code);

  if (opts?.amenities?.length) {
    results = results.filter((l) => opts.amenities!.every((a) => l.amenities.includes(a)));
  }

  if (opts?.accessMethods?.length) {
    results = results.filter((l) => l.accessMethods.some((am) => opts.accessMethods!.includes(am)));
  }

  if (opts?.maxDayPassPrice != null) {
    results = results.filter((l) => l.dayPassPrice != null && l.dayPassPrice <= opts.maxDayPassPrice!);
  }

  const enriched = results
    .map((l) => ({
      ...l,
      userHasAccess: l.accessMethods.includes("day_pass") || l.accessMethods.includes("priority_pass"),
    }))
    .sort((a, b) => b.rating - a.rating);

  return { lounges: enriched, totalCount: enriched.length, airport: code };
}

export function listAirportsWithLounges(): string[] {
  return [...new Set(LOUNGES.map((l) => l.airport))].sort();
}

export function getLoungeById(id: string): (Lounge & { userHasAccess: boolean }) | null {
  const lounge = LOUNGES.find((l) => l.id === id);
  if (!lounge) return null;
  return {
    ...lounge,
    userHasAccess: lounge.accessMethods.includes("day_pass") || lounge.accessMethods.includes("priority_pass"),
  };
}
