import { alpha2ToAlpha3 } from "./countryCodes";

export type LinkPlatform = "instagram" | "tiktok" | "youtube" | "facebook" | "other";

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
    if (host.includes("facebook.com") || host === "fb.watch" || host === "fb.me")
      return "facebook";
  } catch {
    /* ignore */
  }
  return "other";
}

/** True for a social link we can analyze (Instagram / TikTok / Facebook / YouTube). */
export function isSocialUrl(url: string): boolean {
  return detectPlatform(url) !== "other";
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

/**
 * Engagement-bait / call-to-action lines that travel creators open or close
 * with — never the activity title (e.g. "Follow for more", "Save this",
 * "Tag someone", "Send to a friend", "Comment X for the link").
 */
const FILLER_RE =
  /\b(follow|followed|fav|favou?rite|save|saved|share|shared|tag|tagged|comment|like|subscribe|swipe|repost|dm)\b|link in (bio|profile)|send (this|it|to)|drop a|who('?s| is| wants| else| would)|would you|double tap|turn on|check (the|out)|credit|link below|🔗/i;

/** Strip emoji, hashtags, @mentions, and bullet glyphs so we judge the words. */
function captionLineText(line: string): string {
  return stripEmoji(line)
    .replace(/#[^\s#]+/g, "")
    .replace(/@[^\s@]+/g, "")
    .replace(/[•·►▶\-–—|]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** True for blank / emoji-only / hashtag-only / call-to-action lines. */
function isFillerLine(line: string): boolean {
  const t = captionLineText(line);
  if (t.length < 3) return true;
  return FILLER_RE.test(t);
}

/**
 * Generate geocode-ready place strings from a caption, strongest first.
 * Line-aware (does NOT collapse newlines) so the 📍 line is read on its own.
 */
function placeStringsFromCaption(caption: string | null, extra: string | null): string[] {
  const out: string[] = [];
  const push = (v: string | null | undefined) => {
    const t = v
      ? stripEmoji(v)
          .replace(/#[^\s#]+/g, "")
          .replace(/@[^\s@]+/g, "")
          .replace(/[•·►▶|]+/g, " ")
          .replace(/[.,!]+$/, "")
          .replace(/\s{2,}/g, " ")
          .trim()
      : "";
    if (t.length >= 3 && t.length <= 70 && !out.includes(t)) out.push(t);
  };

  const lines = (caption ?? "").split(/\n+/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // 📍 pin marker — the strongest, most explicit signal.
    const pin = line.match(/📍\s*(.+)$/u);
    if (pin) push(pin[1]);
    // "Location: X", "Spot: X", "Where: X"
    const lab = line.match(/^(?:location|place|spot|where|find it)\s*:\s*(.+)$/i);
    if (lab) push(lab[1]);
  }

  // A "City, Country" / "Place, Country" pair anywhere in the caption.
  const cc = stripEmoji(caption ?? "").match(
    /([A-Z][A-Za-zÀ-ÿ'-]+(?:\s+[A-Z][A-Za-zÀ-ÿ'-]+){0,3}),\s*([A-Z][A-Za-zÀ-ÿ'-]+(?:\s+[A-Z][A-Za-zÀ-ÿ'-]+){0,2})/,
  );
  if (cc) push(cc[0]);

  // "in Patagonia", "at Mount Bromo" anywhere.
  const inAt = stripEmoji([caption, extra].filter(Boolean).join("\n")).match(
    /\b(?:in|at)\s+([A-Z][A-Za-zÀ-ÿ\s'-]{2,40}(?:,\s*[A-Z][A-Za-zÀ-ÿ\s'-]{2,40})?)/,
  );
  if (inAt) push(inAt[1]);

  // A single descriptive hashtag as a last resort (#Patagonia).
  const tags = [...(caption ?? "").matchAll(/#([A-Z][a-zA-Z]{3,30})/g)].map((x) => x[1]);
  if (tags.length === 1) push(tags[0]);

  return out;
}

/**
 * Expand a place string into geocode attempts, most-specific first.
 *
 * Nominatim is fussy with POI names: "Lisong Hot Springs, Taiwan" and even the
 * plural "Lisong Hot Springs" return nothing, yet "Lisong, Taiwan" pins right
 * next to it. So for a "Place Words, Country" we try the full string, the place
 * on its own, then the place anchored to its country while progressively
 * dropping trailing (often generic) words — but never the bare country, whose
 * centroid would drop a misleading pin.
 */
function geocodeVariants(place: string): string[] {
  const variants: string[] = [place];
  const parts = place.split(",").map((s) => s.trim()).filter(Boolean);
  const head = parts[0] ?? place;
  const country = parts.length >= 2 ? parts[parts.length - 1] : null;
  const words = head.split(/\s+/).filter(Boolean);

  if (country) variants.push(head); // place without the country/region
  // Progressively shorten the place, keeping the country as an anchor.
  for (let k = words.length; k >= 1; k--) {
    const shortened = words.slice(0, k).join(" ");
    if (country) variants.push(`${shortened}, ${country}`);
    else if (k < words.length) variants.push(shortened);
  }

  return [...new Set(variants)].filter((v) => v.replace(/[^A-Za-zÀ-ÿ]/g, "").length >= 3);
}

/**
 * A clean activity title from a caption. Prefers the explicit place name
 * (e.g. "Lisong Hot Springs"); otherwise the first substantive, non-filler
 * line. Never the engagement-bait first line.
 */
function activityFromCaption(
  caption: string | null,
  title: string | null,
  placeName: string | null,
): string | null {
  const clamp = (s: string) => (s.length > 90 ? s.slice(0, 87) + "…" : s);

  // 1) The place itself makes the best, most specific title.
  if (placeName) {
    const p = captionLineText(placeName.split(",")[0]);
    if (p.length >= 3) return clamp(p);
  }

  // 2) First substantive caption line that isn't filler or a full sentence.
  for (const raw of (caption ?? "").split(/\n+/)) {
    if (isFillerLine(raw)) continue;
    const line = captionLineText(raw).replace(/📍/gu, "").replace(/[.,!?:]+$/, "").trim();
    if (line.length < 3) continue;
    if (line.split(/\s+/).length > 12) continue; // a paragraph, not a title
    return clamp(line);
  }

  // 3) Fall back to a cleaned-up post title.
  const t = title ? captionLineText(stripPlatformSuffix(title)) : "";
  if (t.length >= 3 && !/^(@\w+\s*)+$/i.test(t) && !isFillerLine(title ?? "")) return clamp(t);

  return null;
}

/**
 * Resolve a caption to a geocoded location + a clean activity name.
 * Tries every candidate place (and its country-stripped variants) in order.
 */
async function resolveLocation(
  caption: string | null,
  extra: string | null,
): Promise<{ geocode: Awaited<ReturnType<typeof geocodeQuery>>; locationQuery: string | null; placeName: string | null }> {
  const places = placeStringsFromCaption(caption, extra);
  const placeName: string | null = places[0] ?? null;
  for (const place of places) {
    for (const variant of geocodeVariants(place)) {
      const geocode = await geocodeQuery(variant);
      if (geocode) return { geocode, locationQuery: variant, placeName: place };
    }
  }
  return { geocode: null, locationQuery: placeName, placeName };
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

  const { geocode, locationQuery, placeName } = await resolveLocation(
    description ?? title,
    rawText ?? null,
  );
  const activityName = activityFromCaption(description ?? title, title, placeName);

  return {
    platform,
    title,
    description,
    thumbnailUrl,
    // Cover is left to the post's own thumbnail (set in the form); we no longer
    // auto-generate a Wikipedia/Google cover on import.
    coverImageUrl: null,
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

  const { geocode, locationQuery, placeName } = await resolveLocation(caption, rawText ?? null);

  // Activity name from a real analysis of the whole caption (place name first,
  // then the first substantive line) — never the engagement-bait first line.
  const activityName = activityFromCaption(caption, og.title, placeName);

  return {
    platform: "instagram",
    title: og.title,
    description,
    thumbnailUrl: og.image,
    // Default cover = the reel's own thumbnail (applied in the form). We no
    // longer auto-generate a Wikipedia/Google cover on import.
    coverImageUrl: null,
    author,
    activityName,
    notes: buildNotes({ description, author, url, platform: "instagram", rawText }),
    locationQuery,
    geocode,
  };
}
