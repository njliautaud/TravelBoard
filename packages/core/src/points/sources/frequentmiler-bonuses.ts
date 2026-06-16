/**
 * Frequent Miler "current point transfer bonuses" adapter (HTML scrape).
 *
 * Recon (2026-06-11): https://frequentmiler.com/current-point-transfer-bonuses/
 * serves 200 to a browser UA and maintains TablePress tables of every active
 * (and historical) transfer bonus with columns:
 *   Transfer From | Transfer Bonus Details | Start Date | End Date
 * Detail strings are extremely regular:
 *   "30% transfer bonus from Citi ThankYou Rewards to Qatar Privilege Club Avios"
 * Date cells carry a numeric TablePress sort key prefixed to the visible
 * MM/DD/YY date (e.g. "4617406/01/26") — we take the trailing date only.
 *
 * No API exists for this data anywhere free — HTML scrape via the source-adapter
 * framework (6h TTL, stale-grace) is the design answer, not a hack.
 */

import type { PointsSourceAdapter, TransferBonus, ProgramId } from '../types.js';
import { fetchText } from './adapter.js';

const URL = 'https://frequentmiler.com/current-point-transfer-bonuses/';

const PROGRAM_PATTERNS: Array<[RegExp, ProgramId]> = [
  [/chase\s+ultimate/i, 'chase_ur'],
  [/amex|american\s+express|membership\s+rewards/i, 'amex_mr'],
  [/capital\s+one/i, 'cap1_miles'],
  [/citi\s+thankyou/i, 'citi_typ'],
  [/\bbilt\b/i, 'bilt'],
  [/wells\s+fargo/i, 'wf_rewards'],
];

const PARTNER_PATTERNS: Array<[RegExp, string]> = [
  [/british\s+airways/i, 'ba_avios'],
  [/qatar/i, 'qatar_avios'],
  [/iberia/i, 'iberia_avios'],
  [/aer\s+lingus/i, 'aer_lingus_avios'],
  [/virgin\s+atlantic|flying\s+club/i, 'virgin_atlantic'],
  [/flying\s+blue|air\s+france|klm/i, 'flying_blue'],
  [/aeroplan|air\s+canada/i, 'aeroplan'],
  [/avianca|lifemiles/i, 'avianca'],
  [/turkish/i, 'turkish'],
  [/united\s+mileageplus|\bunited\b/i, 'united'],
  [/american\s+airlines|aadvantage/i, 'american'],
  [/alaska/i, 'alaska'],
  [/emirates/i, 'emirates'],
  [/etihad/i, 'etihad'],
  [/singapore|krisflyer/i, 'singapore'],
  [/cathay|asia\s+miles/i, 'cathay'],
  [/qantas/i, 'qantas'],
  [/jetblue|trueblue/i, 'jetblue'],
  [/delta/i, 'delta'],
  [/\bana\b|all\s+nippon/i, 'ana'],
  [/\beva\b/i, 'eva'],
  [/\bthai\b/i, 'thai'],
  [/finnair/i, 'finnair'],
  [/\btap\b/i, 'tap'],
  [/aeromexico/i, 'aeromexico'],
  [/marriott/i, 'marriott'],
  [/hyatt/i, 'hyatt'],
  [/\bihg\b/i, 'ihg'],
  [/hilton/i, 'hilton'],
  [/choice/i, 'choice'],
  [/wyndham/i, 'wyndham'],
  [/accor/i, 'accor'],
];

function matchProgram(text: string): ProgramId | null {
  for (const [re, id] of PROGRAM_PATTERNS) if (re.test(text)) return id;
  return null;
}

function matchPartner(text: string): string | null {
  for (const [re, id] of PARTNER_PATTERNS) if (re.test(text)) return id;
  return null;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "4617406/01/26" or "06/01/26" → "2026-06-01"; null on garbage. */
export function parseFmDate(cell: string): string | null {
  const m = cell.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*$/);
  if (!m) return null;
  const mm = m[1]!.padStart(2, '0');
  const dd = m[2]!.padStart(2, '0');
  const yy = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
  const iso = `${yy}-${mm}-${dd}`;
  return Number.isFinite(Date.parse(`${iso}T00:00:00Z`)) ? iso : null;
}

/**
 * Parse the FM transfer-bonus tables out of raw page HTML.
 * Exported for fixture-based unit tests. Only rows that map onto OUR six
 * ecosystems + known partners and are currently active are returned.
 */
export function parseFrequentMilerBonuses(html: string, now: Date = new Date()): TransferBonus[] {
  const fetchedAt = new Date().toISOString();
  const today = now.toISOString().slice(0, 10);
  const out: TransferBonus[] = [];
  const seen = new Set<string>();

  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rowMatch[1]!.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) =>
      stripTags(c[1]!),
    );
    if (cells.length < 2) continue;
    const [fromCell, detailCell, startCell, endCell] = cells;
    if (!detailCell || /transfer bonus details/i.test(detailCell)) continue; // header row

    const pct = detailCell.match(/(\d+(?:\.\d+)?)\s*%\s*transfer\s*bonus/i);
    if (!pct) continue;
    const program = matchProgram(fromCell ?? '');
    if (!program) continue; // Rove/Marriott/etc — not one of our six ecosystems
    // partner = the text after "to " in the detail string (fall back to full string)
    const toPart = detailCell.match(/\bto\s+(.+)$/i)?.[1] ?? detailCell;
    const partner = matchPartner(toPart);
    if (!partner) continue;

    const startDate = startCell ? (parseFmDate(startCell) ?? undefined) : undefined;
    const endDate = endCell ? (parseFmDate(endCell) ?? undefined) : undefined;
    // active window only (page also lists historical bonuses further down)
    if (endDate && endDate < today) continue;
    if (startDate && startDate > today) continue;

    const bonus = Number(pct[1]) / 100;
    if (!(bonus > 0 && bonus <= 2)) continue; // sanity

    const key = `${program}|${partner}|${bonus}|${endDate ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      program,
      partner,
      bonus,
      startDate,
      endDate,
      description: detailCell,
      source: 'frequentmiler-bonuses',
      fetchedAt,
    });
  }
  return out;
}

export class FrequentMilerBonusesAdapter implements PointsSourceAdapter<TransferBonus[]> {
  readonly id = 'frequentmiler-bonuses';
  readonly kind = 'html' as const;

  async fetch(): Promise<TransferBonus[]> {
    const html = await fetchText(URL);
    const bonuses = parseFrequentMilerBonuses(html);
    // An empty parse on a 200 page means the layout changed — treat as failure
    // so the runner serves the previous payload as STALE instead of "no bonuses".
    if (bonuses.length === 0 && !/transfer bonus/i.test(html)) {
      throw new Error('frequentmiler page fetched but no bonus table recognized (layout change?)');
    }
    return bonuses;
  }
}
