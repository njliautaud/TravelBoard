// Wikimedia blocks requests without a descriptive User-Agent (returns 403).
import { coverProxyPath } from "@/lib/coverProxy";

const WIKI_HEADERS = {
  "User-Agent": "TravelBoard/0.1 (personal travel journal; contact: travelboard@example.com)",
  Accept: "application/json",
};

const FETCH_OPTS = { cache: "no-store" as RequestCache, headers: WIKI_HEADERS };

export type CoverImageSource = "wikipedia" | "commons" | "google";

export type CoverCandidate = {
  url: string;
  previewUrl: string;
  source: CoverImageSource;
};

function toCandidate(url: string, source: Exclude<CoverImageSource, "google">): CoverCandidate {
  return { url, previewUrl: coverProxyPath(url, 320), source };
}

/** Google Custom Search — Creative Commons / public domain images only. */
async function googleCreativeCommonsImages(query: string, limit = 6): Promise<CoverCandidate[]> {
  const key = process.env.GOOGLE_CSE_API_KEY?.trim();
  const cx = process.env.GOOGLE_CSE_CX?.trim();
  if (!key || !cx) return [];

  const out: CoverCandidate[] = [];
  try {
    const params = new URLSearchParams({
      key,
      cx,
      q: query,
      searchType: "image",
      num: String(Math.min(limit, 10)),
      safe: "active",
      // Creative Commons & public domain only
      rights: "cc_publicdomain,cc_attribute,cc_sharealike,cc_noncommercial,cc_nonderived",
    });
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, FETCH_OPTS);
    if (!res.ok) return out;
    const data = await res.json();
    const items = (data?.items ?? []) as {
      link?: string;
      image?: { thumbnailLink?: string; thumbnailWidth?: number };
    }[];
    for (const item of items) {
      const url = item.link?.trim();
      if (!url?.startsWith("http")) continue;
      out.push({ url, previewUrl: coverProxyPath(url, 320), source: "google" });
    }
  } catch {
    /* empty */
  }
  return out;
}

async function wikiPageImage(title: string): Promise<string | null> {
  try {
    const wikiRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      FETCH_OPTS,
    );
    if (!wikiRes.ok) return null;
    const data = await wikiRes.json();
    const thumb = data?.thumbnail?.source ?? data?.originalimage?.source;
    if (typeof thumb === "string" && thumb.startsWith("http")) return thumb;
  } catch {
    /* try next */
  }
  return null;
}

async function wikiSearchImages(query: string, limit = 5): Promise<string[]> {
  const out: string[] = [];
  try {
    const params = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: String(limit),
      format: "json",
      origin: "*",
    });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, FETCH_OPTS);
    if (!res.ok) return out;
    const data = await res.json();
    const hits = (data?.query?.search ?? []) as { title: string }[];
    for (const hit of hits) {
      const img = await wikiPageImage(hit.title);
      if (img) out.push(img);
    }
  } catch {
    /* empty */
  }
  return out;
}

async function commonsSearchImages(query: string, limit = 8): Promise<string[]> {
  const out: string[] = [];
  try {
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "6",
      gsrlimit: String(limit),
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "480",
      format: "json",
      origin: "*",
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, FETCH_OPTS);
    if (!res.ok) return out;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return out;
    for (const page of Object.values(pages) as { imageinfo?: { thumburl?: string; url?: string }[] }[]) {
      const info = page.imageinfo?.[0];
      const url = info?.thumburl ?? info?.url;
      if (url?.startsWith("http")) out.push(url);
    }
  } catch {
    /* empty */
  }
  return out;
}

async function wikiSearchImage(query: string): Promise<string | null> {
  const imgs = await wikiSearchImages(query, 4);
  return imgs[0] ?? null;
}

async function commonsSearchImage(query: string): Promise<string | null> {
  const imgs = await commonsSearchImages(query, 8);
  return imgs[0] ?? null;
}

/** Free cover-image lookup via Wikipedia (no API key). Falls back to Wikimedia Commons search. */
export async function searchCoverImage(query: string): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;

  const direct = await wikiPageImage(q);
  if (direct) return direct;

  const searched = await wikiSearchImage(q);
  if (searched) return searched;

  return commonsSearchImage(q);
}

/** Strip common activity verbs so "Hike the Hall of Mosses" → "Hall of Mosses". */
function stripActivityVerb(name: string): string {
  return name
    .replace(/^(hike|visit|explore|see|discover|climb|swim|drive to|day trip to|trip to)\s+(the\s+)?/i, "")
    .trim();
}

function buildLocationLabel(fields: CoverSearchFields): string {
  return [fields.city, fields.region, fields.countryName].filter(Boolean).join(", ");
}

/** Build an ordered list of search queries — activity + location combined first. */
export function coverSearchQueries(fields: CoverSearchFields): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (q: string | null | undefined) => {
    const t = q?.trim();
    if (!t || t.length < 3 || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    out.push(t);
  };

  const activity = fields.activityName?.trim() ?? "";
  const stripped = activity ? stripActivityVerb(activity) : "";
  const placeName =
    stripped.split(/[,–—]/).map((p) => p.trim()).filter(Boolean).pop() ?? stripped;
  const location = buildLocationLabel(fields);

  // Priority 1: activity/place name together with full location
  if (placeName && location) {
    push(`${placeName}, ${location}`);
    if (stripped && stripped !== placeName) push(`${stripped}, ${location}`);
    if (activity && activity !== stripped && activity !== placeName) push(`${activity}, ${location}`);
  } else if (stripped && location) {
    push(`${stripped}, ${location}`);
  } else if (activity && location) {
    push(`${activity}, ${location}`);
  }

  // Priority 2: place + partial location
  if (placeName) {
    if (fields.city && fields.countryName) push(`${placeName}, ${fields.city}, ${fields.countryName}`);
    if (fields.region && fields.countryName) push(`${placeName}, ${fields.region}, ${fields.countryName}`);
    if (fields.city && fields.region) push(`${placeName}, ${fields.city}, ${fields.region}`);
    if (fields.city) push(`${placeName}, ${fields.city}`);
    if (fields.countryName) push(`${placeName}, ${fields.countryName}`);
    push(placeName);
  }

  // Priority 3: full activity string alone
  if (stripped) push(stripped);
  if (activity && activity !== stripped) push(activity);

  // Priority 4: location-only fallbacks
  push(location);
  if (fields.city && fields.region) push(`${fields.city}, ${fields.region}`);
  if (fields.city && fields.countryName) push(`${fields.city}, ${fields.countryName}`);
  if (fields.region && fields.countryName) push(`${fields.region}, ${fields.countryName}`);
  if (fields.city) push(fields.city);
  if (fields.countryName) push(fields.countryName);

  return out;
}

export type CoverSearchFields = {
  activityName: string;
  city?: string | null;
  region?: string | null;
  countryName?: string | null;
};

/** Collect up to [limit] cover options — Wikipedia, Commons, then Google (CC-licensed). */
export async function listCoverCandidates(
  fields: CoverSearchFields,
  limit = 3,
): Promise<CoverCandidate[]> {
  let queries = coverSearchQueries(fields);
  if (queries.length === 0) {
    const fallback = fields.activityName?.trim() || buildLocationLabel(fields);
    if (fallback) queries = [fallback];
  }

  const seen = new Set<string>();
  const pool: CoverCandidate[] = [];

  const add = (c: CoverCandidate | null | undefined) => {
    if (!c?.url || seen.has(c.url)) return;
    seen.add(c.url);
    pool.push(c);
  };

  for (const q of queries) {
    if (pool.length >= limit) break;

    const [direct, wikiHits, commonsHits, googleHits] = await Promise.all([
      wikiPageImage(q),
      wikiSearchImages(q, 4),
      commonsSearchImages(q, 6),
      googleCreativeCommonsImages(q, 4),
    ]);

    if (direct) add(toCandidate(direct, "wikipedia"));
    for (const u of wikiHits) add(toCandidate(u, "wikipedia"));
    for (const u of commonsHits) add(toCandidate(u, "commons"));
    for (const c of googleHits) add(c);
  }

  return pool.slice(0, limit);
}

/** Collect unique cover-image URLs across Wikipedia + Commons for all query variants. */
export async function listCoverImageCandidates(fields: CoverSearchFields): Promise<string[]> {
  const candidates = await listCoverCandidates(fields, 12);
  return candidates.map((c) => c.url);
}

/** Try several place-specific queries until one returns a photo. */
export async function resolveCoverImage(fields: CoverSearchFields): Promise<string | null> {
  const candidates = await listCoverImageCandidates(fields);
  return candidates[0] ?? null;
}

/** @deprecated Use coverSearchQueries / resolveCoverImage instead. */
export function coverSearchQuery(fields: {
  activityName: string;
  city?: string | null;
  region?: string | null;
  countryName?: string | null;
}): string {
  return coverSearchQueries(fields)[0] ?? fields.activityName;
}

/** Resolve cover from an enrichment location string + geocode result. */
export async function resolveCoverFromPlace(
  locationQuery: string | null,
  geocode: { city: string | null; region: string | null; countryName: string | null } | null
): Promise<string | null> {
  const queries = [
    locationQuery,
    geocode ? [geocode.city, geocode.region].filter(Boolean).join(", ") : null,
    geocode ? [geocode.city, geocode.countryName].filter(Boolean).join(", ") : null,
    geocode ? [geocode.region, geocode.countryName].filter(Boolean).join(", ") : null,
  ].filter((q): q is string => Boolean(q?.trim()));

  for (const q of queries) {
    const img = await searchCoverImage(q);
    if (img) return img;
  }
  return null;
}
