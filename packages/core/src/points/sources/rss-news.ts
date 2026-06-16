/**
 * RSS news adapter — secondary corroboration channel for the points game.
 *
 * Recon (2026-06-11): frequentmiler.com/feed, doctorofcredit.com/feed and
 * onemileatatime.com/feed all serve valid RSS to a browser UA (default UAs get
 * Cloudflare-challenged). We pull titles+links and keep items matching
 * points/transfer keywords; the board surfaces them as a lightweight
 * "points news" ticker and they corroborate the scraped bonus table.
 */

import type { PointsSourceAdapter } from '../types.js';
import { fetchText } from './adapter.js';

export interface PointsNewsItem {
  title: string;
  link: string;
  pubDate: string | null; // ISO when parseable
  feed: string;
}

const KEYWORDS = /transfer bonus|transfer partner|points transfer|avios|membership rewards|ultimate rewards|thankyou|bilt|venture miles/i;

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;|&#8212;/g, '–')
    .replace(/&#\d+;/g, '')
    .trim();
}

export function parseRssItems(xml: string, feed: string): PointsNewsItem[] {
  const items: PointsNewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1]!;
    const title = decode(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
    const link = decode(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '');
    const pub = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '';
    if (!title || !link) continue;
    const t = Date.parse(pub);
    items.push({ title, link, pubDate: Number.isFinite(t) ? new Date(t).toISOString() : null, feed });
  }
  return items;
}

export interface RssNewsAdapterOptions {
  feeds?: Array<{ id: string; url: string }>;
  /** keep only points-relevant items (default true) */
  filter?: boolean;
  maxItems?: number;
}

const DEFAULT_FEEDS = [
  { id: 'frequentmiler', url: 'https://frequentmiler.com/feed/' },
  { id: 'doctorofcredit', url: 'https://www.doctorofcredit.com/feed/' },
  { id: 'onemileatatime', url: 'https://onemileatatime.com/feed/' },
];

export class RssNewsAdapter implements PointsSourceAdapter<PointsNewsItem[]> {
  readonly id = 'points-rss-news';
  readonly kind = 'rss' as const;
  private readonly feeds: Array<{ id: string; url: string }>;
  private readonly filter: boolean;
  private readonly maxItems: number;

  constructor(opts: RssNewsAdapterOptions = {}) {
    this.feeds = opts.feeds ?? DEFAULT_FEEDS;
    this.filter = opts.filter ?? true;
    this.maxItems = opts.maxItems ?? 30;
  }

  async fetch(): Promise<PointsNewsItem[]> {
    // partial tolerance: one dead feed must not kill the rest (aggregate pattern)
    const settled = await Promise.allSettled(
      this.feeds.map(async (f) => parseRssItems(await fetchText(f.url), f.id)),
    );
    const items = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    if (items.length === 0) throw new Error('all RSS feeds failed or returned no items');
    const kept = this.filter ? items.filter((i) => KEYWORDS.test(i.title)) : items;
    return kept
      .sort((a, b) => (b.pubDate ?? '').localeCompare(a.pubDate ?? ''))
      .slice(0, this.maxItems);
  }
}
