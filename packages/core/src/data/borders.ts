/**
 * Country border lines extracted from Natural Earth 110m
 * (ne_110m_admin_0_boundary_lines_land). Each border is a polyline in [lon, lat].
 * Used by drawBorders() to overlay subtle country dividers on top of land fill.
 */
import bordersGeoJson from './ne_110m_borders.json' with { type: 'json' };

type Line = Array<[number, number]>;

function extractLines(geo: typeof bordersGeoJson): Line[] {
  const out: Line[] = [];
  for (const feature of (geo as any).features) {
    const { type, coordinates } = feature.geometry;
    if (type === 'LineString') {
      out.push(coordinates as Line);
    } else if (type === 'MultiLineString') {
      for (const line of coordinates as unknown as number[][][]) {
        out.push(line as unknown as Line);
      }
    }
  }
  return out;
}

export const COUNTRY_BORDERS: Line[] = extractLines(bordersGeoJson);
