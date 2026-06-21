// Client-safe helper (no sharp import) for routing thumbnails through server proxies.

import { coverProxyPath, isAllowedCoverHost } from "@/lib/coverProxy";

const SOCIAL_CDN_RE =
  /(cdninstagram\.com|fbcdn\.net|tiktokcdn|ytimg\.com|sndcdn\.com|akamaihd\.net)/i;

/**
 * If `url` is a social-platform thumbnail (with a baked-in play button), return
 * a proxied URL that strips the button. Otherwise return the URL unchanged.
 */
export function cleanThumb(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    if (SOCIAL_CDN_RE.test(new URL(url).hostname)) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {
    /* not a valid URL */
  }
  return url;
}

/**
 * Display URL for cover photos in the UI (sidebar, form picker, details modal, map hover).
 * Routes external hosts through /api/cover-proxy so images load reliably in the browser.
 */
export function coverImageSrc(url: string | null | undefined, width = 480): string | undefined {
  if (!url?.trim()) return undefined;
  const trimmed = url.trim();

  if (trimmed.startsWith("/")) return trimmed;
  if (trimmed.startsWith("/api/")) return trimmed;

  try {
    const host = new URL(trimmed).hostname;
    if (SOCIAL_CDN_RE.test(host)) {
      return `/api/image-proxy?url=${encodeURIComponent(trimmed)}`;
    }
    if (isAllowedCoverHost(host)) {
      return coverProxyPath(trimmed, width);
    }
  } catch {
    return undefined;
  }

  return trimmed;
}

/** @deprecated use coverImageSrc */
export function coverPreviewUrl(url: string, maxWidth = 320): string {
  return coverImageSrc(url, maxWidth) ?? url;
}
