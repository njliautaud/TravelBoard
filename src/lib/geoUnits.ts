// Maps a wish to its "geo unit" — normally its country, but when "USA as states"
// is on, a US wish maps to its state instead. This single helper backs the map
// heatmap counts, country/state clicks, and the SidePanel wish filtering so they
// always agree on what belongs where.

import type { LocationItem } from "./types";
import { stateByName, stateForPoint, type UsStateFeature } from "./usStates";

export interface GeoUnit {
  code: string;
  name: string;
}

export interface UnitOptions {
  usaAsStates: boolean;
  states: UsStateFeature[] | null;
}

type LocLike = Pick<
  LocationItem,
  "countryCode" | "countryName" | "region" | "latitude" | "longitude"
>;

/** The geo unit (country, or US state when enabled) a wish belongs to. */
export function unitForLocation(loc: LocLike, opts: UnitOptions): GeoUnit {
  if (opts.usaAsStates && loc.countryCode === "USA" && opts.states?.length) {
    const st =
      stateForPoint(opts.states, loc.longitude, loc.latitude) ??
      stateByName(opts.states, loc.region);
    if (st) return { code: st.id, name: st.properties.name };
  }
  return { code: loc.countryCode, name: loc.countryName };
}

/** Count wishes per geo unit (used for map glow intensity). */
export function countByUnit(locations: LocLike[], opts: UnitOptions): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const l of locations) {
    const { code } = unitForLocation(l, opts);
    counts[code] = (counts[code] ?? 0) + 1;
  }
  return counts;
}
