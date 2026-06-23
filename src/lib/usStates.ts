// US-state geometry + point-in-polygon, used when "USA as states" is enabled so
// each state becomes its own clickable, separately-counted map unit.
// Data: public/data/us-states.geo.json (id "US-XX", properties.name/postal).

export interface UsStateFeature {
  type: "Feature";
  id: string; // e.g. "US-WA"
  properties: { name: string; postal: string; iso?: string; count?: number; accent?: string };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

let cache: Promise<UsStateFeature[]> | null = null;

/** Fetch the state polygons once and cache the promise for all callers. */
export function loadUsStates(): Promise<UsStateFeature[]> {
  if (!cache) {
    cache = fetch("/data/us-states.geo.json")
      .then((r) => r.json())
      .then((geo) => geo.features as UsStateFeature[])
      .catch((e) => {
        cache = null; // allow a retry on the next call
        throw e;
      });
  }
  return cache;
}

/** Ray-casting point-in-polygon for a single ring (outer or hole). */
function pointInRing(ring: number[][], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** A polygon = outer ring minus any holes. */
function pointInPolygon(rings: number[][][], lng: number, lat: number): boolean {
  if (rings.length === 0 || !pointInRing(rings[0], lng, lat)) return false;
  for (let h = 1; h < rings.length; h++) {
    if (pointInRing(rings[h], lng, lat)) return false; // inside a hole
  }
  return true;
}

function pointInFeature(feat: UsStateFeature, lng: number, lat: number): boolean {
  if (feat.geometry.type === "Polygon") {
    return pointInPolygon(feat.geometry.coordinates as number[][][], lng, lat);
  }
  return (feat.geometry.coordinates as number[][][][]).some((poly) =>
    pointInPolygon(poly, lng, lat),
  );
}

/** Which state contains this coordinate, if any. */
export function stateForPoint(
  states: UsStateFeature[],
  lng: number,
  lat: number,
): UsStateFeature | null {
  for (const s of states) {
    if (pointInFeature(s, lng, lat)) return s;
  }
  return null;
}

/** Fallback lookup when coordinates miss every polygon: match a region string. */
export function stateByName(
  states: UsStateFeature[],
  region: string | null | undefined,
): UsStateFeature | null {
  if (!region) return null;
  const q = region.trim().toLowerCase();
  if (!q) return null;
  return (
    states.find(
      (s) => s.properties.name.toLowerCase() === q || s.properties.postal.toLowerCase() === q,
    ) ?? null
  );
}
