/**
 * API base URL — points to the Jupiter backend tunnel when running as a
 * static export (GitHub Pages), or falls back to empty string (same origin)
 * in dev/SSR mode.
 *
 * Set NEXT_PUBLIC_API_URL at build time to override.
 */
export const API_BASE: string =
  process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Patch the global fetch so that any request to `/api/...` is rewritten to
 * `${API_BASE}/api/...` when API_BASE is set. This avoids touching every
 * single component that calls fetch.
 *
 * Call this once from the root client layout / entry point.
 */
export function installApiFetchPatch(): void {
  if (typeof window === "undefined" || !API_BASE) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    if (typeof input === "string" && input.startsWith("/api/")) {
      input = `${API_BASE}${input}`;
    } else if (input instanceof URL && input.pathname.startsWith("/api/")) {
      input = new URL(`${API_BASE}${input.pathname}${input.search}${input.hash}`);
    } else if (input instanceof Request && new URL(input.url).pathname.startsWith("/api/")) {
      const url = new URL(input.url);
      input = new Request(
        `${API_BASE}${url.pathname}${url.search}${url.hash}`,
        input,
      );
    }
    return originalFetch(input, init);
  } as typeof window.fetch;
}
