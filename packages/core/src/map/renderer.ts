/**
 * Shared canvas map engine. Pure drawing over a standard 2D context (works in the browser board and,
 * via a Skia/canvas shim, the mobile app later). Equirectangular projection.
 *
 * v2 visual upgrade: deep atmospheric ocean (radial vignette + subtle star field),
 * gradient land with outer glow halo + crisp inner stroke, major/minor graticule distinction,
 * and an edge vignette frame. Function signatures unchanged so the board and mobile keep working.
 */

import type { FareTier, GeoPoint, Trip } from '../types.js';
import type { FareQuote } from '../providers/types.js';
import { TIER_COLORS } from '../fares/tiering.js';
import { project, greatCirclePoints, subsolarPoint, isDaylight } from '../geo.js';
import type { SeasonalActivity } from '../data/seasonal_activities.js';

// HC #612 perf: the seasonal-activities dataset (~1 MB of source literals) is only used here
// to pick a label glyph per marker. Self-load it as a lazy chunk so it stays OUT of the
// board's critical-path bundle; markers simply render without glyphs until it arrives
// (the canvas redraws continuously, so glyphs appear within a frame of the chunk loading).
let activitiesLookup: ((code: string, month: number) => SeasonalActivity[]) | null = null;
import('../data/seasonal_activities.js')
  .then((m) => { activitiesLookup = m.activitiesFor; })
  .catch(() => { /* glyphs are cosmetic — render without them */ });

// HC #531 — wall-device glance-readability constants.
// Dot radius scales with tier so the eye snaps to greens (cheap) first.
// Round 10 (2026-06-14): bumped radii for better visual weight + added
// outer ring for premium depth perception.
const TIER_DOT_RADIUS: Record<FareTier, number> = {
  cheap: 7,
  fair: 4.5,
  splurge: 3,
};
// Cap of pinned labels we draw to avoid label-cloud chaos on the wall.
const MAX_PINNED_LABELS = 8;

/** Map seasonal activity to a single-glyph icon for use as a label prefix. */
function activityGlyph(act: SeasonalActivity | undefined): string {
  switch (act) {
    case 'Skiing': return '\u26F7';      // skier
    case 'Beach': return '\u{1F3D6}';    // beach umbrella
    case 'Hiking': return '\u{1F97E}';   // hiking boot
    case 'Wildlife': return '\u{1F98C}'; // deer
    case 'City/Culture': return '\u{1F3D9}'; // cityscape
    case 'Festivals': return '\u{1F389}';
    case 'Foliage': return '\u{1F341}';
    case 'Diving': return '\u{1F93F}';
    case 'Nightlife': return '\u{1F379}';
    default: return '';
  }
}

/** Pick the most distinctive seasonal activity for a destination this month. */
function pickActivity(destCode: string, month: number): SeasonalActivity | undefined {
  const acts = activitiesLookup ? activitiesLookup(destCode, month) : [];
  if (!acts || acts.length === 0) return undefined;
  // Prefer specific-tag activities over generic City/Culture for visual differentiation.
  const ranked: SeasonalActivity[] = [
    'Skiing', 'Beach', 'Hiking', 'Diving', 'Foliage', 'Wildlife',
    'Festivals', 'Nightlife', 'City/Culture',
  ];
  for (const r of ranked) {
    if (acts.includes(r)) return r;
  }
  return acts[0];
}

export interface OceanStyle {
  top?: string;
  bottom?: string;
}

export interface FareMarker {
  fare: FareQuote;
  tier: FareTier;
  isBestDeal: boolean;
  /** glow ring (e.g. a watched route below target, or the pushed deal) */
  highlighted?: boolean;
  /** HC #617 — verified award deal (seats.aero): violet dot + points label */
  award?: boolean;
  /** label text override (awards show "60k pts" instead of "$price") */
  labelText?: string;
}

/** HC #617 — verified-award marker color (violet; distinct from all fare tiers). */
export const AWARD_COLOR = '#c084fc';

const DEFAULT_OCEAN: Required<OceanStyle> = { top: '#060b18', bottom: '#0c1a30' };

// ---- star field (cached, deterministic) -----------------------------------
// Generated once with a seeded LCG so the layout is stable across redraws.
interface Star { x: number; y: number; r: number; a: number; tw: number }
let STAR_CACHE: { w: number; h: number; stars: Star[] } | null = null;

function generateStars(w: number, h: number, count = 220): Star[] {
  let seed = 0x2dd4bf;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * w,
      y: rand() * h,
      r: 0.4 + rand() * 1.3,
      a: 0.15 + rand() * 0.55,
      tw: rand() * Math.PI * 2,
    });
  }
  return stars;
}

/** Fill the ocean background with a vertical gradient, radial vignette, and a subtle star field. */
export function drawOcean(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: OceanStyle = {},
): void {
  const s = { ...DEFAULT_OCEAN, ...style };

  // 1. Base vertical gradient (deeper at top + bottom, lifted in middle for atmosphere).
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, s.top);
  g.addColorStop(0.45, '#0e2040');
  g.addColorStop(1, s.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 2. Radial vignette — soft warm core (atmospheric lift) fading to dark at edges.
  const r = Math.max(w, h) * 0.7;
  const rg = ctx.createRadialGradient(w / 2, h / 2, r * 0.15, w / 2, h / 2, r);
  rg.addColorStop(0, 'rgba(56,108,180,0.18)');
  rg.addColorStop(0.55, 'rgba(20,40,80,0.0)');
  rg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);

  // 3. Star field — cached per-size, twinkles with time.
  if (!STAR_CACHE || STAR_CACHE.w !== w || STAR_CACHE.h !== h) {
    STAR_CACHE = { w, h, stars: generateStars(w, h, Math.round((w * h) / 9000)) };
  }
  const tnow = Date.now() / 1000;
  ctx.save();
  for (const st of STAR_CACHE.stars) {
    const tw = 0.55 + 0.45 * Math.sin(tnow * 1.7 + st.tw);
    ctx.globalAlpha = st.a * tw;
    ctx.fillStyle = '#cfe3ff';
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Faint lat/lon graticule with major lines (equator, prime travelboard, tropics) stronger. */
export function drawGraticule(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.lineWidth = 1;

  // Minor lines every 15°
  ctx.strokeStyle = 'rgba(120,160,200,0.05)';
  for (let lon = -180; lon <= 180; lon += 15) {
    if (lon % 30 === 0) continue;
    const { x } = project({ lat: 0, lon }, w, h);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    if (lat % 30 === 0) continue;
    const { y } = project({ lat, lon: 0 }, w, h);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Major lines every 30°
  ctx.strokeStyle = 'rgba(140,180,220,0.10)';
  for (let lon = -180; lon <= 180; lon += 30) {
    const { x } = project({ lat: 0, lon }, w, h);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const { y } = project({ lat, lon: 0 }, w, h);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Featured: equator + prime travelboard + tropics (warmer accent)
  ctx.strokeStyle = 'rgba(255,196,128,0.16)';
  ctx.lineWidth = 1.2;
  const eq = project({ lat: 0, lon: 0 }, w, h);
  ctx.beginPath(); ctx.moveTo(0, eq.y); ctx.lineTo(w, eq.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(eq.x, 0); ctx.lineTo(eq.x, h); ctx.stroke();

  ctx.strokeStyle = 'rgba(255,196,128,0.08)';
  ctx.setLineDash([4, 6]);
  for (const lat of [23.5, -23.5]) {
    const { y } = project({ lat, lon: 0 }, w, h);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.restore();
}

/** Draw land polygons (GeoJSON-style rings of [lon, lat]) — gradient fill + outer glow halo + crisp stroke. */
export function drawLand(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  polygons: Array<Array<[number, number]>>,
  fill = 'rgba(80,110,150,0.22)',
  stroke = 'rgba(140,180,220,0.25)',
): void {
  ctx.save();

  // Build a single path with all rings so gradient/stroke applies uniformly.
  const path = new Path2D();
  for (const ring of polygons) {
    ring.forEach(([lon, lat], i) => {
      const { x, y } = project({ lat, lon }, w, h);
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    path.closePath();
  }

  // 1. Outer glow halo — wide soft cyan-blue glow that lifts continents off the ocean.
  // Round 10: slightly wider glow for more atmospheric separation.
  ctx.shadowColor = 'rgba(110,180,230,0.4)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(70,110,160,0.10)';
  ctx.fill(path);
  ctx.shadowBlur = 0;

  // 2. Main fill — vertical gradient so land has top-light/bottom-dark depth.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  // Honour custom fill if caller passed one that's clearly different from default
  if (fill === 'rgba(80,110,150,0.22)') {
    grad.addColorStop(0, 'rgba(118,150,196,0.42)');
    grad.addColorStop(0.55, 'rgba(72,104,156,0.36)');
    grad.addColorStop(1, 'rgba(40,68,112,0.32)');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = fill;
  }
  ctx.fill(path);

  // 3. Crisp inner stroke — coastline definition.
  ctx.strokeStyle = stroke === 'rgba(140,180,220,0.25)' ? 'rgba(180,215,245,0.55)' : stroke;
  ctx.lineWidth = 0.9;
  ctx.stroke(path);

  // 4. Faint secondary outer stroke for atmosphere.
  ctx.strokeStyle = 'rgba(140,200,255,0.15)';
  ctx.lineWidth = 2.4;
  ctx.globalCompositeOperation = 'lighter';
  ctx.stroke(path);
  ctx.globalCompositeOperation = 'source-over';

  ctx.restore();
}

/** Discovery layer: tinted, optionally haloed/price-tagged destination nodes.
 *  Highlighted markers (watched routes below target, or pushed deals) get a pulsing glow ring.
 *  Pass `now` (ms timestamp) to drive the pulse animation; omit for a static glow.
 */
export function drawFares(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  markers: FareMarker[],
  opts: { showPrices?: boolean; now?: number } = {},
): void {
  ctx.save();
  // Pulse cycle: 2-second period, sinusoidal alpha between 0.5 and 1.0
  const pulse = opts.now != null ? 0.5 + 0.5 * Math.sin((opts.now / 1000) * Math.PI) : 1;
  const pulseRadius = opts.now != null ? 16 + 4 * Math.sin((opts.now / 1000) * Math.PI) : 16;

  // HC #531 R3 — collect candidate labels first; draw markers, then resolve label
  // collisions before drawing the pinned rich labels (origin→dest + price + glyph).
  // Cap to top-N (highlighted always win, then cheap best-deals, then everything else by price).
  const month = opts.now != null ? new Date(opts.now).getMonth() : new Date().getMonth();

  interface LabelCand {
    x: number; y: number; code: string; color: string;
    text: string; glyph: string; priority: number;
  }
  const labelCands: LabelCand[] = [];

  for (const m of markers) {
    const { x, y } = project({ lat: m.fare.lat, lon: m.fare.lon }, w, h);
    const color = m.award ? AWARD_COLOR : TIER_COLORS[m.tier];

    // glow for best deals / highlighted (highlighted = watched-below-target OR pushed deal)
    if (m.isBestDeal || m.highlighted) {
      const glowR = m.highlighted ? pulseRadius : 12;
      const glowAlpha = m.highlighted ? 0.18 * pulse : 0.18;
      const strokeAlpha = m.highlighted ? 0.5 + 0.4 * pulse : 0.9;

      // outer glow fill
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = hexWithAlpha(color, glowAlpha);
      ctx.fill();

      // glow ring
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.strokeStyle = hexWithAlpha(color, strokeAlpha);
      ctx.lineWidth = m.highlighted ? 2.5 : 1.5;
      ctx.stroke();
    }

    // HC #531 — node radius now scales by tier so the eye lands on greens (cheap) first.
    // Best-deal/highlighted get an extra +1.5 boost on top of the tier baseline.
    // Round 10: added subtle outer ring for depth + smoother glow falloff.
    const baseR = TIER_DOT_RADIUS[m.tier];
    const nodeR = (m.isBestDeal || m.highlighted) ? baseR + 1.5 : baseR;

    // Outer halo ring (subtle depth indicator for all dots)
    ctx.beginPath();
    ctx.arc(x, y, nodeR + 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = hexWithAlpha(color, 0.2);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Main dot with layered glow
    ctx.beginPath();
    ctx.arc(x, y, nodeR, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = m.highlighted ? 20 * pulse : m.isBestDeal ? 14 : 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner highlight (gives dots a glossy 3D look)
    if (nodeR > 3) {
      ctx.beginPath();
      ctx.arc(x - nodeR * 0.2, y - nodeR * 0.25, nodeR * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
    }

    // HC #531 — collect candidate for pinned-label pass.
    // Format: "JFK→ROM $312" with activity glyph prefix when available.
    if ((opts.showPrices && (m.isBestDeal || m.award)) || m.highlighted) {
      const origin = m.fare.flyFrom || '';
      const dest = m.fare.flyTo;
      const price = m.labelText ?? '$' + String(m.fare.price);
      const text = origin ? `${origin}\u2192${dest} ${price}` : `${dest} ${price}`;
      const glyph = m.award ? '\u2726' : activityGlyph(pickActivity(dest, month));
      // Priority: highlighted (pushed/watched) > cheap best-deal > award > fair best-deal > rest by price.
      const priority = (m.highlighted ? 0 : m.award ? 1.5 : m.tier === 'cheap' ? 1 : m.tier === 'fair' ? 2 : 3) * 100000 + m.fare.price;
      labelCands.push({ x, y, code: dest, color, text, glyph, priority });
    }
  }

  // ---- Pinned-label pass (HC #531 R3) -------------------------------------
  // Sort by priority, draw up to MAX_PINNED_LABELS, AABB collision-skip.
  labelCands.sort((a, b) => a.priority - b.priority);
  ctx.font = '700 13px ui-sans-serif, system-ui, sans-serif';
  const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
  let drawn = 0;
  const PAD_X = 8;
  const LABEL_H = 22;
  for (const c of labelCands) {
    if (drawn >= MAX_PINNED_LABELS) break;
    const fullText = c.glyph ? `${c.glyph} ${c.text}` : c.text;
    const tw = ctx.measureText(fullText).width;
    const boxW = tw + PAD_X * 2;
    const boxH = LABEL_H;
    // Default: place label to the right of the dot, slightly above.
    let bx = c.x + 12;
    let by = c.y - boxH - 4;
    // Clamp inside viewport so wall device never has labels off-screen.
    if (bx + boxW > w - 4) bx = c.x - boxW - 12;
    if (by < 4) by = c.y + 10;
    if (bx < 4) bx = 4;
    if (by + boxH > h - 4) by = h - boxH - 4;
    // Collision check vs already-placed labels.
    let collides = false;
    for (const p of placed) {
      if (bx < p.x + p.w + 2 && bx + boxW + 2 > p.x && by < p.y + p.h + 2 && by + boxH + 2 > p.y) {
        collides = true;
        break;
      }
    }
    if (collides) continue;
    placed.push({ x: bx, y: by, w: boxW, h: boxH });
    // Leader line from dot to label box.
    ctx.strokeStyle = hexWithAlpha(c.color, 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(bx + boxW / 2, by + boxH / 2);
    ctx.stroke();
    // Background pill — Round 10: shadow + rounded for premium look.
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = 'rgba(8,12,20,0.92)';
    roundRect(ctx, bx, by, boxW, boxH, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = hexWithAlpha(c.color, 0.7);
    ctx.lineWidth = 1;
    roundRect(ctx, bx, by, boxW, boxH, 8);
    ctx.stroke();
    // Text — colored to match the tier so the wall still reads as
    // "green = great deal, amber = OK, coral = pricey" at a glance.
    ctx.fillStyle = c.color;
    ctx.textBaseline = 'middle';
    ctx.fillText(fullText, bx + PAD_X, by + boxH / 2);
    drawn++;
  }
  ctx.restore();
}

/**
 * HC #531 — Top-line wall headline.
 * Pinned at the top-center of the map. Communicates the single best deal in one glance,
 * before the user even starts scanning the dots. Caller passes the chosen "headline" deal
 * (typically the cheapest fare and its origin's typical-price delta).
 */
export interface HeadlineSpec {
  origin: string;
  dest: string;
  price: number;
  /** Optional "X% below typical" — caller computes; omit if unknown. */
  pctBelowTypical?: number;
  /** Optional activity tag for the destination this month. */
  activity?: SeasonalActivity;
}
export function drawHeadline(
  ctx: CanvasRenderingContext2D,
  w: number,
  _h: number,
  spec: HeadlineSpec | null,
): void {
  if (!spec) return;
  ctx.save();
  const glyph = activityGlyph(spec.activity);
  const route = `${spec.origin}\u2192${spec.dest}`;
  const price = '$' + String(spec.price);
  const pct = spec.pctBelowTypical != null && spec.pctBelowTypical > 0
    ? `  (${Math.round(spec.pctBelowTypical)}% below typical)`
    : '';
  const head = 'Best Deal Today: ';
  ctx.font = '700 18px ui-sans-serif, system-ui, sans-serif';
  const headW = ctx.measureText(head).width;
  const routeW = ctx.measureText(route + '  ').width;
  ctx.font = '800 20px ui-sans-serif, system-ui, sans-serif';
  const priceW = ctx.measureText(price).width;
  ctx.font = '500 14px ui-sans-serif, system-ui, sans-serif';
  const pctW = pct ? ctx.measureText(pct).width : 0;
  const glyphW = glyph ? 22 : 0;
  const totalW = glyphW + headW + routeW + priceW + pctW + 36;
  const bx = (w - totalW) / 2;
  const by = 14;
  const bh = 40;
  // Background pill — Round 10: elevated shadow + subtler stroke.
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = 'rgba(8,12,20,0.85)';
  roundRect(ctx, bx, by, totalW, bh, 14);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // Subtle teal gradient stroke for premium feel.
  ctx.strokeStyle = 'rgba(45,212,191,0.45)';
  ctx.lineWidth = 1;
  roundRect(ctx, bx, by, totalW, bh, 14);
  ctx.stroke();
  let cx = bx + 18;
  ctx.textBaseline = 'middle';
  const cy = by + bh / 2;
  if (glyph) {
    ctx.font = '500 18px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(230,240,255,0.95)';
    ctx.fillText(glyph, cx, cy);
    cx += glyphW;
  }
  ctx.font = '700 14px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(180,200,225,0.85)';
  ctx.fillText(head, cx, cy);
  cx += headW;
  ctx.font = '800 16px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = '#e6efff';
  ctx.fillText(route + '  ', cx, cy);
  cx += routeW;
  ctx.font = '800 18px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = TIER_COLORS.cheap;
  ctx.fillText(price, cx, cy);
  cx += priceW;
  if (pct) {
    ctx.font = '500 13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(170,200,180,0.9)';
    ctx.fillText(pct, cx, cy);
  }
  ctx.restore();
}

/**
 * HC #531 — Tiny legend chip pinned bottom-left of the map.
 * Three colored dots with labels so a first-time wall-glancer learns the palette.
 */
export function drawLegend(ctx: CanvasRenderingContext2D, _w: number, h: number): void {
  ctx.save();
  const items: Array<{ color: string; label: string }> = [
    { color: TIER_COLORS.cheap, label: 'Great' },
    { color: TIER_COLORS.fair, label: 'OK' },
    { color: TIER_COLORS.splurge, label: 'Pricey' },
  ];
  ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
  const widths = items.map(it => 14 + ctx.measureText(it.label).width);
  const totalW = widths.reduce((a, b) => a + b + 10, 0) + 10;
  const bh = 24;
  const bx = 14;
  const by = h - bh - 14;
  // Round 10: refined legend with shadow for depth.
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = 'rgba(8,12,20,0.82)';
  roundRect(ctx, bx, by, totalW, bh, 10);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(140,170,200,0.2)';
  ctx.lineWidth = 0.8;
  roundRect(ctx, bx, by, totalW, bh, 10);
  ctx.stroke();
  let cx = bx + 12;
  const cy = by + bh / 2;
  ctx.textBaseline = 'middle';
  items.forEach((it, i) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = it.color;
    ctx.fill();
    cx += 9;
    ctx.fillStyle = 'rgba(220,232,248,0.92)';
    ctx.fillText(it.label, cx, cy);
    cx += ctx.measureText(it.label).width + 10;
    if (i < items.length - 1) cx += 2;
  });
  ctx.restore();
}


/** Draw a polyline that breaks at the antitravelboard to avoid horizontal wrap. */
function strokeAntitravelboardAware(
  ctx: CanvasRenderingContext2D,
  points: GeoPoint[],
  w: number,
  h: number,
): void {
  if (points.length === 0) return;
  let prev = project(points[0]!, w, h);
  ctx.beginPath();
  ctx.moveTo(prev.x, prev.y);
  for (let i = 1; i < points.length; i++) {
    const cur = project(points[i]!, w, h);
    // If the x jump is more than half the canvas width, the arc crossed the antitravelboard
    if (Math.abs(cur.x - prev.x) > w * 0.5) {
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cur.x, cur.y);
    } else {
      ctx.lineTo(cur.x, cur.y);
    }
    prev = cur;
  }
  ctx.stroke();
}

/** Memory layer: pins + great-circle arcs from a home point to each trip. */
export function drawTrips(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  home: GeoPoint,
  trips: Trip[],
  arcColor = 'rgba(45,212,191,0.5)',
  pinColor = '#2dd4bf',
): void {
  ctx.save();
  // arcs (with soft glow underlay)
  ctx.shadowColor = arcColor;
  ctx.shadowBlur = 6;
  ctx.strokeStyle = arcColor;
  ctx.lineWidth = 1.4;
  for (const t of trips) {
    const pts = greatCirclePoints(home, t, 64);
    strokeAntitravelboardAware(ctx, pts, w, h);
  }
  ctx.shadowBlur = 0;
  // pins
  for (const t of trips) {
    const { x, y } = project(t, w, h);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = pinColor;
    ctx.shadowColor = pinColor;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  // home (with ring)
  const hp = project(home, w, h);
  ctx.beginPath();
  ctx.arc(hp.x, hp.y, 8, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(251,191,36,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hp.x, hp.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#fbbf24';
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

/** Live layer: a flight marker + its travelled path. */
export function drawFlight(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  from: GeoPoint,
  to: GeoPoint,
  position: GeoPoint,
  progress: number,
): void {
  ctx.save();
  const pts = greatCirclePoints(from, to, 96);
  // full route faint
  ctx.strokeStyle = 'rgba(160,200,240,0.25)';
  ctx.lineWidth = 1;
  strokeAntitravelboardAware(ctx, pts, w, h);
  // travelled portion bright + glowing
  const cut = Math.max(1, Math.floor(progress * pts.length));
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.2;
  strokeAntitravelboardAware(ctx, pts.slice(0, cut), w, h);
  ctx.shadowBlur = 0;
  // aircraft marker
  const pos = project(position, w, h);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.restore();
}

/** Ambient layer: shade the night side using the day/night terminator for `date`. */
export function drawTerminator(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  date: Date,
): void {
  const sun = subsolarPoint(date);
  ctx.save();
  // sample a grid and darken night cells (coarse but cheap)
  const step = 6;
  for (let px = 0; px < w; px += step) {
    for (let py = 0; py < h; py += step) {
      const lon = (px / w) * 360 - 180;
      const lat = 90 - (py / h) * 180;
      if (!isDaylight({ lat, lon }, sun)) {
        ctx.fillStyle = 'rgba(2,6,16,0.45)';
        ctx.fillRect(px, py, step, step);
      }
    }
  }
  ctx.restore();
}

/** Atmospheric edge vignette — darkens the corners to frame the map. Call last (after land/markers). */
export function drawEdgeVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  const r = Math.hypot(w, h) * 0.55;
  const rg = ctx.createRadialGradient(w / 2, h / 2, r * 0.55, w / 2, h / 2, r);
  rg.addColorStop(0, 'rgba(0,0,0,0)');
  rg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ---- HC #527 R5: country borders + city labels ---------------------------

import type { PopulatedPlace } from '../data/places.js';

/**
 * Stroke country borders as subtle polylines.
 * `scale` is the current view zoom (1 = world); we taper opacity/width slightly so
 * borders stay readable at high zoom without overpowering land at low zoom.
 */
export function drawBorders(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lines: Array<Array<[number, number]>>,
  scale = 1,
): void {
  if (!lines || lines.length === 0) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(120, 170, 220, 0.32)';
  ctx.lineWidth = 0.5 / Math.max(1, scale * 0.9);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const line of lines) {
    if (line.length < 2) continue;
    ctx.beginPath();
    let lastX = NaN;
    for (let i = 0; i < line.length; i++) {
      const [lon, lat] = line[i]!;
      const { x, y } = project({ lat, lon }, w, h);
      // antitravelboard guard — if the segment jumps across the wrap, lift the pen
      if (!isNaN(lastX) && Math.abs(x - lastX) > w * 0.6) {
        ctx.moveTo(x, y);
      } else if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      lastX = x;
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Render city name labels. Reveal more labels as zoom increases.
 * - scale 1     → world view: only scalerank ≤ 1 (≈ 30 mega-cities)
 * - scale 2-3   → scalerank ≤ 3
 * - scale 4-6   → scalerank ≤ 5
 * - scale 7+    → scalerank ≤ 8 (most named cities)
 * Labels also get bigger at higher zoom, but world labels stay small + airy.
 */
export function drawCityLabels(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  places: PopulatedPlace[],
  scale = 1,
): void {
  if (!places || places.length === 0) return;
  let maxRank: number;
  if (scale < 1.5) maxRank = 1;
  else if (scale < 3) maxRank = 3;
  else if (scale < 5) maxRank = 5;
  else if (scale < 7) maxRank = 7;
  else maxRank = 9;

  const fontPx = Math.min(13, 9 + scale * 0.6);
  ctx.save();
  ctx.font = `${fontPx / scale}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'middle';

  // Simple collision avoidance grid in unscaled-screen space.
  const cellPx = 64 / scale;
  const cols = Math.max(1, Math.ceil(w / cellPx));
  const rows = Math.max(1, Math.ceil(h / cellPx));
  const occupied = new Uint8Array(cols * rows);

  for (const p of places) {
    if (p.scalerank > maxRank) continue;
    const { x, y } = project({ lat: p.lat, lon: p.lon }, w, h);
    if (x < 0 || x > w || y < 0 || y > h) continue;
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(x / cellPx)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(y / cellPx)));
    const idx = cy * cols + cx;
    if (occupied[idx]) continue;
    occupied[idx] = 1;

    // Dot
    ctx.fillStyle = 'rgba(200, 220, 240, 0.85)';
    ctx.beginPath();
    ctx.arc(x, y, 1.4 / scale, 0, Math.PI * 2);
    ctx.fill();

    // Label — outlined white text for contrast over both land + ocean.
    const label = p.name;
    const offsetY = 6 / scale;
    ctx.lineWidth = 3 / scale;
    ctx.strokeStyle = 'rgba(8, 14, 28, 0.85)';
    ctx.fillStyle = 'rgba(230, 240, 255, 0.95)';
    ctx.textAlign = 'center';
    ctx.strokeText(label, x, y + offsetY + fontPx / (2 * scale));
    ctx.fillText(label, x, y + offsetY + fontPx / (2 * scale));
  }
  ctx.restore();
}

// ---- helpers ---------------------------------------------------------------

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---- TravelBoard wish pins -------------------------------------------------

/** A personal wish pin on the map (TravelBoard integration). */
export interface WishPin {
  lat: number;
  lon: number;
  label: string;
  starred: boolean;
  isDeal: boolean;
  isVisited: boolean;
}

const WISH_COLOR_ACTIVE = '#f59e0b'; // amber-500
const WISH_COLOR_DEAL = '#f43f5e';   // rose-500
const WISH_COLOR_VISITED = '#34d399'; // emerald-400

/**
 * Draw personal wish pins on the map. Uses a distinct teardrop shape
 * to differentiate from fare dots. Deal-matching wishes pulse.
 */
export function drawWishPins(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pins: WishPin[],
  opts: { now?: number } = {},
): void {
  if (pins.length === 0) return;
  ctx.save();
  const pulse = opts.now != null ? 0.5 + 0.5 * Math.sin((opts.now / 1000) * Math.PI) : 1;

  for (const pin of pins) {
    const { x, y } = project({ lat: pin.lat, lon: pin.lon }, w, h);
    const color = pin.isDeal ? WISH_COLOR_DEAL : pin.isVisited ? WISH_COLOR_VISITED : WISH_COLOR_ACTIVE;
    const radius = pin.starred ? 7 : 5.5;

    // Outer glow for deal pins (pulsing)
    if (pin.isDeal) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
      ctx.fillStyle = hexWithAlpha(WISH_COLOR_DEAL, 0.15 * pulse);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
      ctx.strokeStyle = hexWithAlpha(WISH_COLOR_DEAL, 0.4 * pulse);
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Star glow for starred pins
    if (pin.starred && !pin.isDeal) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
      ctx.fillStyle = hexWithAlpha(WISH_COLOR_ACTIVE, 0.12);
      ctx.fill();
    }

    // Pin body — teardrop shape
    ctx.beginPath();
    ctx.moveTo(x, y - radius - 2);
    ctx.bezierCurveTo(x + radius + 1, y - radius, x + radius, y + 1, x, y + radius + 3);
    ctx.bezierCurveTo(x - radius, y + 1, x - radius - 1, y - radius, x, y - radius - 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = pin.isDeal ? 14 * pulse : 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner highlight
    ctx.beginPath();
    ctx.arc(x - radius * 0.15, y - radius * 0.3, radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();

    // Label (short name)
    if (pin.label) {
      const short = pin.label.length > 18 ? pin.label.slice(0, 16) + '\u2026' : pin.label;
      ctx.font = `600 ${pin.starred ? 11 : 10}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = hexWithAlpha('#ffffff', 0.9);
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 3;
      ctx.fillText(short, x, y + radius + 14);
      ctx.shadowBlur = 0;
    }
  }
  ctx.restore();
}
