/**
 * Geo utility helpers for TravelBoard.
 *
 * Re-exports from @travelboard/core where available, adds the day/night
 * terminator polygon generator that the Ambient mode needs.
 */

export {
  EARTH_RADIUS_MILES,
  haversineMiles,
  greatCirclePoints,
  interpolateGreatCircle,
  project,
  subsolarPoint,
  isDaylight,
} from "@travelboard/core";

import { subsolarPoint, isDaylight } from "@travelboard/core";
import type { GeoPoint } from "@travelboard/core";

// ── Day/night terminator ────────────────────────────────────────────────────

const DEG2RAD = Math.PI / 180;

/**
 * Generate the day/night terminator as a ring of lon/lat points.
 * The terminator is the set of points where solar elevation = 0.
 * Returns ~360 points tracing the boundary (one per degree of longitude).
 */
export function terminatorPoints(date: Date): GeoPoint[] {
  const sub = subsolarPoint(date);
  const declRad = sub.lat * DEG2RAD;
  const points: GeoPoint[] = [];

  for (let lonDeg = -180; lonDeg <= 180; lonDeg += 1) {
    const hRad = (lonDeg - sub.lon) * DEG2RAD;
    // At the terminator, sin(elev)=0:
    //   sin(lat)*sin(decl) + cos(lat)*cos(decl)*cos(h) = 0
    //   tan(lat) = -cos(h) * cos(decl)/sin(decl) = -cos(h)/tan(decl)
    const tanDecl = Math.tan(declRad);
    if (Math.abs(tanDecl) < 1e-12) {
      // Equinox: terminator is at lon offset +/-90 from subsolar
      points.push({ lat: 0, lon: lonDeg });
    } else {
      const latRad = Math.atan(-Math.cos(hRad) / tanDecl);
      points.push({ lat: latRad / DEG2RAD, lon: lonDeg });
    }
  }

  return points;
}

/**
 * Generate a GeoJSON polygon for the night side of the earth.
 * Suitable for rendering as a dark overlay on a map.
 */
export function nightPolygon(
  date: Date,
): { type: "Polygon"; coordinates: [number, number][] } {
  const term = terminatorPoints(date);
  const sub = subsolarPoint(date);

  // Determine which side is night. Check a pole: if north pole is in darkness,
  // the night polygon goes north of the terminator; otherwise south.
  const northIsDark = !isDaylight({ lat: 89, lon: 0 }, sub);

  const capLat = northIsDark ? 90 : -90;

  // Build polygon: terminator points, then close along the cap edge
  const coords: [number, number][] = [];

  if (northIsDark) {
    // Terminator left-to-right, then cap at 90
    for (const p of term) {
      coords.push([p.lon, p.lat]);
    }
    // Close along the top
    coords.push([180, capLat]);
    coords.push([-180, capLat]);
  } else {
    // Terminator right-to-left, then cap at -90
    for (let i = term.length - 1; i >= 0; i--) {
      coords.push([term[i]!.lon, term[i]!.lat]);
    }
    coords.push([-180, capLat]);
    coords.push([180, capLat]);
  }

  // Close the ring
  coords.push(coords[0]!);

  return { type: "Polygon", coordinates: coords };
}

// ── Country-to-continent mapping for travel stats ───────────────────────────

const CONTINENT_MAP: Record<string, string> = {
  // North America
  US: "North America", CA: "North America", MX: "North America",
  GT: "North America", BZ: "North America", HN: "North America",
  SV: "North America", NI: "North America", CR: "North America",
  PA: "North America", CU: "North America", JM: "North America",
  HT: "North America", DO: "North America", PR: "North America",
  TT: "North America", BS: "North America", BB: "North America",
  // South America
  BR: "South America", AR: "South America", CO: "South America",
  PE: "South America", VE: "South America", CL: "South America",
  EC: "South America", BO: "South America", PY: "South America",
  UY: "South America", GY: "South America", SR: "South America",
  // Europe
  GB: "Europe", FR: "Europe", DE: "Europe", IT: "Europe", ES: "Europe",
  PT: "Europe", NL: "Europe", BE: "Europe", CH: "Europe", AT: "Europe",
  SE: "Europe", NO: "Europe", DK: "Europe", FI: "Europe", IE: "Europe",
  PL: "Europe", CZ: "Europe", GR: "Europe", RO: "Europe", HU: "Europe",
  HR: "Europe", BG: "Europe", RS: "Europe", SK: "Europe", SI: "Europe",
  LT: "Europe", LV: "Europe", EE: "Europe", IS: "Europe", LU: "Europe",
  MT: "Europe", CY: "Europe", AL: "Europe", ME: "Europe", MK: "Europe",
  BA: "Europe", XK: "Europe", MD: "Europe", UA: "Europe", BY: "Europe",
  // Asia
  CN: "Asia", JP: "Asia", KR: "Asia", IN: "Asia", TH: "Asia",
  VN: "Asia", PH: "Asia", MY: "Asia", SG: "Asia", ID: "Asia",
  TW: "Asia", HK: "Asia", MO: "Asia", MM: "Asia", KH: "Asia",
  LA: "Asia", BD: "Asia", LK: "Asia", NP: "Asia", PK: "Asia",
  AF: "Asia", IR: "Asia", IQ: "Asia", SA: "Asia", AE: "Asia",
  QA: "Asia", KW: "Asia", BH: "Asia", OM: "Asia", YE: "Asia",
  JO: "Asia", LB: "Asia", SY: "Asia", IL: "Asia", TR: "Asia",
  GE: "Asia", AM: "Asia", AZ: "Asia", KZ: "Asia", UZ: "Asia",
  TM: "Asia", KG: "Asia", TJ: "Asia", MN: "Asia", MV: "Asia",
  BN: "Asia", TL: "Asia",
  // Africa
  ZA: "Africa", EG: "Africa", MA: "Africa", KE: "Africa", NG: "Africa",
  ET: "Africa", TZ: "Africa", GH: "Africa", SN: "Africa", CI: "Africa",
  CM: "Africa", UG: "Africa", MZ: "Africa", MG: "Africa", TN: "Africa",
  DZ: "Africa", LY: "Africa", SD: "Africa", AO: "Africa", ZW: "Africa",
  ZM: "Africa", BW: "Africa", NA: "Africa", MW: "Africa", RW: "Africa",
  MU: "Africa", SC: "Africa",
  // Oceania
  AU: "Oceania", NZ: "Oceania", FJ: "Oceania", PG: "Oceania",
  WS: "Oceania", TO: "Oceania", VU: "Oceania", PF: "Oceania",
  NC: "Oceania", GU: "Oceania",
  // Antarctica
  AQ: "Antarctica",
};

/**
 * Look up the continent for a 2-letter ISO country code.
 * Returns "Unknown" if unmapped.
 */
export function continentForCountry(countryCode: string): string {
  return CONTINENT_MAP[countryCode.toUpperCase()] ?? "Unknown";
}
