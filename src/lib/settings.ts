export type MapTheme = "classic" | "flag";

export interface UserSettings {
  mapTheme: MapTheme;
  /** Treat each US state as its own map unit (clickable, counted separately). */
  usaAsStates: boolean;
  homeAirports: string[];
}

export const DEFAULT_SETTINGS: UserSettings = {
  mapTheme: "classic",
  usaAsStates: false,
  homeAirports: [],
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
