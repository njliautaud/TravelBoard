/**
 * Populated places extracted from Natural Earth 110m (ne_110m_populated_places_simple).
 * Each entry is a city point with name, lat/lon, population, and scalerank
 * (a NaturalEarth-curated importance score — lower = bigger/more prominent).
 * Used by drawCityLabels() — labels appear at higher zooms based on scalerank.
 */
import placesGeoJson from './ne_110m_places.json' with { type: 'json' };

export interface PopulatedPlace {
  name: string;
  lat: number;
  lon: number;
  pop: number;
  /** Natural Earth scalerank: lower number = more prominent. Range ~0–10. */
  scalerank: number;
}

function extractPlaces(geo: typeof placesGeoJson): PopulatedPlace[] {
  const out: PopulatedPlace[] = [];
  for (const feature of (geo as any).features) {
    const g = feature.geometry;
    if (!g || g.type !== 'Point') continue;
    const [lon, lat] = g.coordinates as [number, number];
    const props = feature.properties ?? {};
    const name: string = props.name ?? props.NAME ?? props.nameascii ?? '';
    if (!name) continue;
    const pop = Number(props.pop_max ?? props.POP_MAX ?? props.pop ?? 0) || 0;
    const scalerank = Number(props.scalerank ?? props.SCALERANK ?? 10);
    out.push({ name, lat, lon, pop, scalerank });
  }
  // Sort so that the most prominent cities are first (low scalerank first, then higher pop).
  out.sort((a, b) => (a.scalerank - b.scalerank) || (b.pop - a.pop));
  return out;
}

export const POPULATED_PLACES: PopulatedPlace[] = extractPlaces(placesGeoJson);
