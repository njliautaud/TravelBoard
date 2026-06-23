// Wikimedia blocks requests without a descriptive User-Agent (returns 403).
const WIKI_HEADERS = {
  "User-Agent": "TravelBoard/0.1 (personal travel journal; contact: travelboard@example.com)",
  Accept: "application/json",
};

async function wikiPageImage(title: string): Promise<string | null> {
  try {
    const wikiRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      { headers: WIKI_HEADERS, next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) }
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
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: WIKI_HEADERS,
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    });
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
      iiurlwidth: "800",
      format: "json",
      origin: "*",
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: WIKI_HEADERS,
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    });
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

/** Build an ordered list of search queries, most specific first. */
export function coverSearchQueries(fields: {
  activityName: string;
  city?: string | null;
  region?: string | null;
  countryName?: string | null;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (q: string | null | undefined) => {
    const t = q?.trim();
    if (!t || t.length < 3 || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    out.push(t);
  };

  const activity = fields.activityName?.trim() ?? "";
  if (activity) {
    const stripped = stripActivityVerb(activity);
    const segments = stripped.split(/[,–—]/).map((p) => p.trim()).filter(Boolean);
    // Place name usually comes after the comma ("Hike X, Hoh Rainforest") — try it first.
    for (const part of [...segments].reverse()) {
      push(part);
      if (fields.region) push(`${part}, ${fields.region}`);
      if (fields.countryName) push(`${part}, ${fields.countryName}`);
    }
    push(stripped);
  }

  if (fields.city && fields.region) push(`${fields.city}, ${fields.region}`);
  if (fields.city && fields.countryName) push(`${fields.city}, ${fields.countryName}`);
  if (fields.region && fields.countryName) push(`${fields.region}, ${fields.countryName}`);

  // Activity + location combos ("Hall of Mosses, Forks, Washington")
  if (activity) {
    const stripped = stripActivityVerb(activity);
    const place = stripped.split(/[,–—]/).map((p) => p.trim()).filter(Boolean).pop();
    if (place) {
      if (fields.city) push(`${place}, ${fields.city}`);
      if (fields.city && fields.countryName) push(`${place}, ${fields.city}, ${fields.countryName}`);
      if (fields.region && fields.countryName) push(`${place}, ${fields.region}, ${fields.countryName}`);
    }
  }

  return out;
}

export type CoverSearchFields = {
  activityName: string;
  city?: string | null;
  region?: string | null;
  countryName?: string | null;
};

/** Collect unique cover-image URLs across Wikipedia + Commons for all query variants. */
export async function listCoverImageCandidates(fields: CoverSearchFields): Promise<string[]> {
  const queries = coverSearchQueries(fields);
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (url: string | null | undefined) => {
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  };
  const addMany = (urls: string[]) => urls.forEach(add);

  for (const q of queries) {
    add(await wikiPageImage(q));
    addMany(await wikiSearchImages(q, 5));
    addMany(await commonsSearchImages(q, 6));
  }
  return out;
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
