// Capture an Instagram reel cover into the shared DB so it survives across
// machines. cdninstagram/fbcdn URLs are signed + time-limited (they load on the
// machine that minted them, then 403/expire elsewhere), so saving the URL as the
// cover rots. Instead we copy the bytes into StoredImage once and register the
// image in the same ImageCache the "Generate image" search reads — so the cover
// is stable everywhere AND shows up among the generate/regenerate options for
// the same activity.

import sharp from "sharp";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { declutterPlayButton } from "@/lib/declutterImage";
import { normalizeQuery, type PreviewImage } from "@/lib/serperImages";

/** A cached preview image plus the optional origin tag we store for IG covers. */
export type TaggedPreviewImage = PreviewImage & { source?: string };

const IG_CDN_RE = /(cdninstagram\.com|fbcdn\.net)/i;

/** True for an Instagram/Facebook CDN image URL (signed + short-lived). */
export function isInstagramCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return IG_CDN_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/jpeg,image/png,*/*",
};

export type CoverFields = {
  activityName: string;
  city?: string | null;
  region?: string | null;
  countryName?: string | null;
};

/** The exact string the EntryForm "Generate image" button searches with. */
export function coverCacheQuery(fields: CoverFields): string {
  return normalizeQuery(
    [fields.activityName, fields.city, fields.region, fields.countryName]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join(" "),
  );
}

/**
 * Download an Instagram reel cover, persist its bytes to the shared DB, and add
 * it (first) to the ImageCache row for this activity's query. Returns a stable
 * same-origin URL (/api/stored-image/<id>), or null on failure so the caller can
 * fall back to the original URL.
 */
export async function captureInstagramCover(
  url: string,
  fields: CoverFields,
): Promise<string | null> {
  try {
    const upstream = await fetch(url, {
      headers: FETCH_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) return null;
    const raw = Buffer.from(await upstream.arrayBuffer());

    // Strip the reel play-button overlay; fall back to the raw frame on failure.
    const cleaned = await declutterPlayButton(raw).catch(() => raw);

    // Re-encode to a bounded JPEG. This also validates it's a real image — an
    // expired/forbidden URL often returns an HTML body, which sharp rejects.
    let jpeg: Buffer;
    try {
      jpeg = await sharp(cleaned)
        .resize({ width: 1080, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
    } catch {
      return null;
    }

    const stored = await prisma.storedImage.create({
      data: { mime: "image/jpeg", bytes: new Uint8Array(jpeg), source: "instagram" },
    });
    const storedUrl = `/api/stored-image/${stored.id}`;

    // Register in the same cache "Generate image" reads, keyed by the activity
    // query, as the first option — so it's offered for this (and via the fuzzy
    // similar-search reuse, related) wishes.
    const query = coverCacheQuery(fields);
    if (query) {
      const entry: TaggedPreviewImage = {
        imageUrl: storedUrl,
        sourceUrl: null,
        title: fields.activityName?.trim() || null,
        thumbnailUrl: storedUrl,
        width: null,
        height: null,
        source: "instagram",
      };
      const existing = await prisma.imageCache.findUnique({ where: { searchQuery: query } });
      const prior = (existing?.images as unknown as TaggedPreviewImage[] | undefined) ?? [];
      const merged = [entry, ...prior.filter((p) => p.imageUrl !== storedUrl)].slice(0, 12);
      const imagesJson = merged as unknown as Prisma.InputJsonValue;
      await prisma.imageCache.upsert({
        where: { searchQuery: query },
        create: { searchQuery: query, images: imagesJson, source: "instagram" },
        update: { images: imagesJson },
      });
    }

    return storedUrl;
  } catch {
    return null;
  }
}
