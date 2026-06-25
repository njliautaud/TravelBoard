// Passport region options for the "map where you've been" picker.
// Countries come from the same /data/countries.geo.json the map renders (id =
// ISO-3, properties.name); US states from loadUsStates() (id "US-XX").
// Both are cached so the picker and the onboarding modal share one fetch.

import { loadUsStates } from "@/lib/usStates";

export interface RegionOption {
  code: string; // ISO-3 ("USA") or "US-XX"
  name: string;
}

const ISO3 = /^[A-Z]{3}$/;

let countryCache: Promise<RegionOption[]> | null = null;
let stateCache: Promise<RegionOption[]> | null = null;

/** All countries as { code, name }, alphabetical. */
export function loadCountryOptions(): Promise<RegionOption[]> {
  if (!countryCache) {
    countryCache = fetch("/data/countries.geo.json")
      .then((r) => r.json())
      .then((geo: { features: { id: string; properties: { name: string } }[] }) =>
        geo.features
          .map((f) => ({ code: f.id, name: f.properties?.name ?? f.id }))
          // Drop Natural Earth's "-99"/disputed placeholders.
          .filter((o) => ISO3.test(o.code) && o.name)
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
      .catch((e) => {
        countryCache = null;
        throw e;
      });
  }
  return countryCache;
}

/** All US states as { code: "US-XX", name }, alphabetical. */
export function loadStateOptions(): Promise<RegionOption[]> {
  if (!stateCache) {
    stateCache = loadUsStates()
      .then((states) =>
        states
          .map((s) => ({ code: s.id, name: s.properties.name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
      .catch((e) => {
        stateCache = null;
        throw e;
      });
  }
  return stateCache;
}

/** Is this code a US state ("US-XX")? */
export function isUsState(code: string): boolean {
  return code.startsWith("US-");
}

/** Log more than this many US states and the map permanently splits the USA. */
export const STATE_AUTO_SPLIT = 5;

/**
 * Add/remove a region from the passport and decide whether to permanently flip
 * the map into per-state mode. We split the USA when either (a) more than
 * STATE_AUTO_SPLIT states are logged, or (b) the whole USA *and* individual
 * states are both selected (otherwise they'd overlap). Returns a settings patch.
 */
export function passportTogglePatch(
  current: string[],
  code: string,
  usaAsStates: boolean,
): { visitedRegions: string[]; usaAsStates?: boolean } {
  const set = new Set(current.map((c) => c.toUpperCase()));
  const c = code.toUpperCase();
  if (set.has(c)) set.delete(c);
  else set.add(c);
  const next = [...set];

  if (!usaAsStates) {
    const stateCount = next.filter(isUsState).length;
    const hasWholeUsa = set.has("USA");
    if (stateCount > STATE_AUTO_SPLIT || (hasWholeUsa && stateCount > 0)) {
      return { visitedRegions: next, usaAsStates: true };
    }
  }
  return { visitedRegions: next };
}
