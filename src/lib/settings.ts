export type MapTheme = "classic" | "flag";

export type DistancePref = "farther" | "nearby" | "no_preference";
export type FlightPref = "international" | "domestic" | "both";

export interface UserSettings {
  mapTheme: MapTheme;
  /** Treat each US state as its own map unit (clickable, counted separately). */
  usaAsStates: boolean;
  homeAirports: string[];
  /** Distance preference for deal filtering. */
  distancePref: DistancePref;
  /** Flight type preference (international / domestic / both). */
  flightPref: FlightPref;
  /**
   * Passport: codes of countries / US states the user has marked as visited.
   * Country = ISO-3 (e.g. "USA", "FRA"); US state = "US-XX" (e.g. "US-CA").
   * Independent of the wishlist — these only drive the static "been there" glow.
   */
  visitedRegions: string[];
}

export const DEFAULT_SETTINGS: UserSettings = {
  mapTheme: "classic",
  usaAsStates: false,
  homeAirports: [],
  distancePref: "no_preference",
  flightPref: "both",
  visitedRegions: [],
};

export function parseMapTheme(value: string | null | undefined): MapTheme {
  return value === "FLAG" || value === "flag" ? "flag" : "classic";
}

export function toDbMapTheme(theme: MapTheme): "CLASSIC" | "FLAG" {
  return theme === "flag" ? "FLAG" : "CLASSIC";
}

export function normalizeHomeAirports(codes: unknown): string[] {
  if (!Array.isArray(codes)) return [];
  return [...new Set(codes.map((c) => String(c).trim().toUpperCase()).filter((c) => /^[A-Z]{3}$/.test(c)))];
}

/** Country ISO-3 ("USA") or US-state ("US-CA") code. */
const REGION_CODE = /^([A-Z]{3}|US-[A-Z]{2})$/;

/** Sanitize + dedupe a passport region list. Drops anything not a valid code. */
export function normalizeVisitedRegions(codes: unknown): string[] {
  if (!Array.isArray(codes)) return [];
  return [
    ...new Set(
      codes.map((c) => String(c).trim().toUpperCase()).filter((c) => REGION_CODE.test(c)),
    ),
  ];
}
