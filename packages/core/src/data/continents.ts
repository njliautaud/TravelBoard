/**
 * Land polygons extracted from Natural Earth 110m (ne_110m_land.json).
 * Provides smooth, professional coastline outlines for the equirectangular map.
 *
 * The GeoJSON uses [lon, lat] coordinate pairs in each ring — exactly what
 * drawLand() expects.
 */

import landGeoJson from './ne_110m_land.json' with { type: 'json' };

type Ring = Array<[number, number]>;

/**
 * Flatten every Polygon / MultiPolygon ring in the GeoJSON into a single
 * array of [lon, lat] rings that drawLand() can iterate over.
 */
function extractRings(geo: typeof landGeoJson): Ring[] {
  const rings: Ring[] = [];
  for (const feature of geo.features) {
    const { type, coordinates } = feature.geometry;
    if (type === 'Polygon') {
      for (const ring of coordinates as unknown as number[][][]) {
        rings.push(ring as unknown as Ring);
      }
    } else if (type === 'MultiPolygon') {
      for (const polygon of coordinates as unknown as number[][][][]) {
        for (const ring of polygon) {
          rings.push(ring as unknown as Ring);
        }
      }
    }
  }
  return rings;
}

export const CONTINENT_POLYGONS: Ring[] = extractRings(landGeoJson);
