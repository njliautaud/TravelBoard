// Client-safe helper (no sharp import) for routing social thumbnails through
// the play-button removal proxy.

import { API_BASE } from "./api";

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
      return `${API_BASE}/api/image-proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {
    /* not a valid URL */
  }
  return url;
}
