// Serper.dev (Google Images) fetch + helpers for /api/fetch-previews.

export interface PreviewImage {
  imageUrl: string;
  /** Page the image was found on (Serper "link"). */
  sourceUrl: string | null;
  title: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
}

/** "Mauritania Iron Ore Train " -> "mauritania iron ore train" */
export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

// Hosts that don't serve a usable raw image to an anonymous request
// (Facebook/Instagram "lookaside" endpoints return HTML, not an image).
const BAD_IMAGE_HOSTS = [/(^|\.)lookaside\./i, /(^|\.)fbsbx\.com$/i];

function isServableHost(url: string): boolean {
  try {
    return !BAD_IMAGE_HOSTS.some((re) => re.test(new URL(url).hostname));
  } catch {
    return false;
  }
}

/** Deterministic placeholders so the UI still renders if Serper is down or rate-limited. */
export function placeholderImages(query: string, n = 3): PreviewImage[] {
  const seed = encodeURIComponent(normalizeQuery(query) || "travel");
  return Array.from({ length: n }, (_, i) => ({
    imageUrl: `https://picsum.photos/seed/${seed}-${i}/640/480`,
    sourceUrl: null,
    title: null,
    thumbnailUrl: `https://picsum.photos/seed/${seed}-${i}/240/180`,
    width: 640,
    height: 480,
  }));
}

interface SerperImageItem {
  title?: unknown;
  imageUrl?: unknown;
  imageWidth?: unknown;
  imageHeight?: unknown;
  thumbnailUrl?: unknown;
  link?: unknown;
}

/**
 * POST https://google.serper.dev/images and return the top [limit] clean results.
 * Throws on a missing key or non-2xx response so the caller can fall back gracefully.
 */
export async function fetchSerperImages(query: string, limit = 6): Promise<PreviewImage[]> {
  const key = process.env.SERPER_API_KEY?.trim();
  if (!key) throw new Error("SERPER_API_KEY not set");

  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    // Over-fetch a little so we can drop junk hosts and still return [limit].
    body: JSON.stringify({ q: query, num: Math.min(limit * 2 + 4, 20) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`serper ${res.status}`);

  const data = await res.json();
  const items: SerperImageItem[] = Array.isArray(data?.images) ? data.images : [];

  return items
    .map((it) => ({
      imageUrl: typeof it.imageUrl === "string" ? it.imageUrl : "",
      sourceUrl: typeof it.link === "string" ? it.link : null,
      title: typeof it.title === "string" ? it.title : null,
      thumbnailUrl: typeof it.thumbnailUrl === "string" ? it.thumbnailUrl : null,
      width: typeof it.imageWidth === "number" ? it.imageWidth : null,
      height: typeof it.imageHeight === "number" ? it.imageHeight : null,
    }))
    .filter((x) => x.imageUrl.startsWith("http") && isServableHost(x.imageUrl))
    .slice(0, limit);
}
