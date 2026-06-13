import { alpha2ToAlpha3 } from "./countryCodes";
import { resolveCoverFromPlace, resolveCoverImage } from "./coverImage";

export type LinkPlatform = "instagram" | "tiktok" | "youtube" | "other";

export interface LinkEnrichment {
  platform: LinkPlatform;
  title: string | null;
  description: string | null;
  /** Reel/post still frame (may have a baked-in play button on video posts). */
  thumbnailUrl: string | null;
  /** Clean location photo (Wikipedia/Wikimedia) with no play button — preferred cover. */
  coverImageUrl: string | null;
  author: string | null;
  activityName: string | null;
  notes: string | null;
  locationQuery: string | null;
  geocode: {
    displayName: string;
    latitude: number;
    longitude: number;
    countryCode: string | null;
    countryName: string | null;
    region: string | null;
    city: string | null;
  } | null;
}

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

// Instagram only returns real OG metadata (caption, thumbnail) to crawler agents.
const CRAWLER_HEADERS = {
  "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

const NOMINATIM_HEADERS = {
  "User-Agent": "TravelBoard/0.1 (personal travel journal; local dev)",
  "Accept-Language": "en",
};

export function detectPlatform(url: string): LinkPlatform {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("tiktok.com")) return "tiktok";
    if (host === "youtu.be" || host.includes("youtube.com")) return "youtube";
  } catch {
    /* ignore */
  }
  return "other";
}

function metaContent(html: string, key: string, attr: "property" | "name" = "property"): string | null {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${key}["']`,
    "i"
  );
  const m = html.match(re);
  return m ? decodeHtml(m[1] ?? m[2] ?? "") : null;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try {
        return String.fromCodePoint(parseInt(h, 16));
      } catch {
        return "";
      }
    })
    .replace(/&#(\d+);/g, (_, d) => {
      try {
        return String.fromCodePoint(parseInt(d, 10));
      } catch {
        return "";
      }
    })
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

function stripEmoji(s: string): string {
  return s.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
}

/**
 * Parse Instagram's OG tags into caption + author.
 *  og:title       -> `Display Name on Instagram: "caption"`
 *  og:description -> `12K likes, 34 comments - handle on June 9, 2026: "caption".`
 */
function parseInstagramMeta(
  ogTitle: string | null,
  ogDescription: string | null
): { caption: string | null; authorName: string | null; authorHandle: string | null } {
  let caption: string | null = null;
  let authorName: string | null = null;
  let authorHandle: string | null = null;

  if (ogTitle) {
    const m = ogTitle.match(/^(.*?)\s+on\s+Instagram(?::\s*"([\s\S]*)")?\s*$/i);
    if (m) {
      authorName = m[1]?.trim() || null;
      if (m[2]) caption = m[2].trim();
    }
  }

  if (ogDescription) {
    const m = ogDescription.match(/-\s*([\w.]+)\s+on\s+[^:]+:\s*"([\s\S]*?)"\.?\s*$/i);
    if (m) {
      authorHandle = m[1]?.trim() || null;
      const capFromDesc = m[2]?.trim();
      if (capFromDesc && (!caption || capFromDesc.length > caption.length)) {
        caption = capFromDesc;
      }
    }
  }

  return { caption: caption || null, authorName, authorHandle };
}

function stripPlatformSuffix(title: string): string {
  return title
    .replace(/\s+[|\-–—]\s+(Instagram|TikTok|YouTube).*$/i, "")
    .replace(/\s+on\s+(Instagram|TikTok|YouTube).*$/i, "")
    .trim();
}

function cleanActivityName(title: string | null, description: string | null): string | null {
  const badTitle = Boolean(title && /post shared by|reel shared by|video by @/i.test(title));
  const raw =
    (!badTitle && title?.trim()) ||
    description?.split(/[.!?\n]/)[0]?.trim() ||
    description?.trim();
  if (!raw) return null;
  let name = stripPlatformSuffix(raw)
    .replace(/#\w+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (name.length > 90) name = name.slice(0, 87) + "…";
  if (name.length < 3) return null;
  if (/^(@\w+\s*)+$/i.test(name)) return null;
  return name;
}

/** Pull a place name from captions — pin emoji, "in City", location tags, etc. */
export function extractLocationQuery(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;

  const patterns = [
    /📍\s*([^|\n#@]+?)(?:\s*[|#@]|$)/,
    /(?:location|place|spot|where)\s*:\s*([^|\n#@]+?)(?:\s*[|#@]|$)/i,
    /\bin\s+([A-Z][A-Za-zÀ-ÿ\s''-]{2,40}(?:,\s*[A-Z][A-Za-zÀ-ÿ\s''-]{2,40}){0,2})/,
    /(?:at|@)\s+([A-Z][A-Za-zÀ-ÿ\s''-]{2,40}(?:,\s*[A-Z][A-Za-zÀ-ÿ\s''-]{2,40})?)/,
  ];

  for (const re of patterns) {
    const m = t.match(re);
    const place = m?.[1]?.trim().replace(/[.,!]+$/, "");
    if (place && place.length >= 3 && !/^me\b/i.test(place)) return place;
  }

  const tags = [...t.matchAll(/#([A-Z][a-zA-Z]{3,30})/g)].map((x) => x[1]);
  if (tags.length === 1) return tags[0];

  return null;
}

function buildNotes(opts: {
  description: string | null;
  author: string | null;
  url: string;
  platform: LinkPlatform;
  rawText?: string | null;
}): string | null {
  const parts: string[] = [];

  // The post's own caption comes first — that's the journal text.
  const caption = opts.description?.trim();
  if (caption) parts.push(caption);

  if (opts.author) {
    const handle = opts.author.startsWith("@") ? opts.author : `@${opts.author}`;
    parts.push(`Creator: ${handle}`);
  }

  // A personal note you typed in WhatsApp (skip if it's just the link we already saved).
  const whatsapp = opts.rawText?.trim();
  if (whatsapp && whatsapp !== caption && !whatsapp.includes(opts.url)) {
    parts.push(`Your note: ${whatsapp}`);
  }

  return parts.length ? parts.join("\n\n") : null;
}

/** A clean cover photo for the place, independent of the reel's play-button thumbnail. */
async function resolveEnrichmentCover(opts: {
  locationQuery: string | null;
  geocode: { city: string | null; region: string | null; countryName: string | null } | null;
  activityName: string | null;
}): Promise<string | null> {
  const fromPlace = await resolveCoverFromPlace(opts.locationQuery, opts.geocode);
  if (fromPlace) return fromPlace;
  if (opts.activityName || opts.geocode) {
    return resolveCoverImage({
      activityName: opts.activityName ?? opts.locationQuery ?? "",
      city: opts.geocode?.city,
      region: opts.geocode?.region,
      countryName: opts.geocode?.countryName,
    });
  }
  return null;
}

async function fetchOEmbed(
  url: string,
  platform: LinkPlatform
): Promise<{ title?: string; author?: string; thumbnail?: string; description?: string } | null> {
  const endpoints: string[] = [];
  if (platform === "youtube") {
    endpoints.push(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
  } else if (platform === "tiktok") {
    endpoints.push(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  } else if (platform === "instagram") {
    endpoints.push(`https://api.instagram.com/oembed?url=${encodeURIComponent(url)}&omitscript=true`);
  }

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { headers: FETCH_HEADERS, next: { revalidate: 3600 } });
      if (!res.ok) continue;
      const data = await res.json();
      return {
        title: typeof data.title === "string" ? data.title : undefined,
        author: typeof data.author_name === "string" ? data.author_name : undefined,
        thumbnail: typeof data.thumbnail_url === "string" ? data.thumbnail_url : undefined,
        description: typeof data.description === "string" ? data.description : undefined,
      };
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fetchOpenGraph(
  url: string,
  useCrawlerUA = false
): Promise<{
  title: string | null;
  description: string | null;
  image: string | null;
}> {
  try {
    const res = await fetch(url, {
      headers: useCrawlerUA ? CRAWLER_HEADERS : FETCH_HEADERS,
      redirect: "follow",
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { title: null, description: null, image: null };
    const html = await res.text();
    return {
      title: metaContent(html, "og:title") ?? metaContent(html, "twitter:title", "name"),
      description:
        metaContent(html, "og:description") ?? metaContent(html, "description", "name"),
      image: metaContent(html, "og:image") ?? metaContent(html, "twitter:image", "name"),
    };
  } catch {
    return { title: null, description: null, image: null };
  }
}

/** Ordered list of place-name guesses pulled from a caption. */
function locationCandidates(caption: string | null, extra: string | null): string[] {
  const candidates: string[] = [];
  const push = (v: string | null | undefined) => {
    const t = v ? stripEmoji(v).replace(/[#@][\s\S]*$/, "").replace(/[.,!]+$/, "").trim() : "";
    if (t.length >= 3 && t.length <= 70 && !candidates.includes(t)) candidates.push(t);
  };

  const fromPattern = extractLocationQuery([caption, extra].filter(Boolean).join("\n"));
  push(fromPattern);

  if (caption) {
    // Travel creators usually put the place on the first line.
    const firstLine = caption.split("\n")[0];
    push(firstLine);
    // A "City, Country" anywhere in the caption.
    const cc = stripEmoji(caption).match(/([A-Z][A-Za-zÀ-ÿ'-]+(?:\s+[A-Z][A-Za-zÀ-ÿ'-]+)*),\s*([A-Z][A-Za-zÀ-ÿ'-]+(?:\s+[A-Z][A-Za-zÀ-ÿ'-]+)*)/);
    if (cc) push(cc[0]);
  }

  return candidates;
}

async function geocodeQuery(query: string) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: NOMINATIM_HEADERS, next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.[0];
    if (!item) return null;
    const addr = item.address ?? {};
    return {
      displayName: item.display_name ?? query,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      countryCode: alpha2ToAlpha3(addr.country_code),
      countryName: addr.country ?? null,
      region: addr.state ?? addr.region ?? addr.province ?? null,
      city: addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? null,
    };
  } catch {
    return null;
  }
}

/** Fetch title, thumbnail, caption, and best-guess location from a shared social URL. */
export async function enrichLink(url: string, rawText?: string | null): Promise<LinkEnrichment> {
  const platform = detectPlatform(url);

  if (platform === "instagram") {
    return enrichInstagram(url, rawText);
  }

  const oembed = await fetchOEmbed(url, platform);
  const og = await fetchOpenGraph(url);

  const title = oembed?.title ?? og.title;
  const description = oembed?.description ?? og.description;
  const thumbnailUrl = oembed?.thumbnail ?? og.image;
  const author = oembed?.author ?? null;

  const candidates = locationCandidates(description ?? title, rawText ?? null);
  let geocode = null;
  let locationQuery: string | null = candidates[0] ?? null;
  for (const c of candidates) {
    geocode = await geocodeQuery(c);
    if (geocode) {
      locationQuery = c;
      break;
    }
  }

  const activityName = cleanActivityName(title, description);
  const coverImageUrl = await resolveEnrichmentCover({ locationQuery, geocode, activityName });

  return {
    platform,
    title,
    description,
    thumbnailUrl,
    coverImageUrl,
    author,
    activityName,
    notes: buildNotes({ description, author, url, platform, rawText }),
    locationQuery,
    geocode,
  };
}

/** Instagram needs a crawler UA; caption + author come from the OG tags. */
async function enrichInstagram(url: string, rawText?: string | null): Promise<LinkEnrichment> {
  const og = await fetchOpenGraph(url, true);
  const { caption, authorName, authorHandle } = parseInstagramMeta(og.title, og.description);

  const author = authorHandle ?? authorName;
  const description = caption;

  const candidates = locationCandidates(caption, rawText ?? null);
  let geocode = null;
  let locationQuery: string | null = candidates[0] ?? null;
  for (const c of candidates) {
    geocode = await geocodeQuery(c);
    if (geocode) {
      locationQuery = c;
      break;
    }
  }

  // Activity name: caption's first line (the creator's own words), trimmed.
  const firstLine = caption ? stripEmoji(caption.split("\n")[0]).replace(/#\w+/g, "").trim() : null;
  const activityName = firstLine && firstLine.length >= 3 ? firstLine.slice(0, 90) : null;

  const coverImageUrl = await resolveEnrichmentCover({ locationQuery, geocode, activityName });

  return {
    platform: "instagram",
    title: og.title,
    description,
    thumbnailUrl: og.image,
    coverImageUrl,
    author,
    activityName,
    notes: buildNotes({ description, author, url, platform: "instagram", rawText }),
    locationQuery,
    geocode,
  };
}
