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
 * Patch the global fetch so that:
 * 1. Any request to `/api/...` is rewritten to `${API_BASE}/api/...`
 * 2. API responses that aren't OK get converted to proper error Responses
 *    with JSON bodies, preventing crashes when components call `.json()`
 *    on HTML error pages from the proxy/backend.
 *
 * Call this once from the root client layout / entry point.
 */
export function installApiFetchPatch(): void {
  if (typeof window === "undefined") return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    // Determine if this is an API call
    let isApiCall = false;
    if (typeof input === "string" && input.startsWith("/api/")) {
      isApiCall = true;
      if (API_BASE) input = `${API_BASE}${input}`;
    } else if (input instanceof URL && input.pathname.startsWith("/api/")) {
      isApiCall = true;
      if (API_BASE) input = new URL(`${API_BASE}${input.pathname}${input.search}${input.hash}`);
    } else if (input instanceof Request && new URL(input.url).pathname.startsWith("/api/")) {
      isApiCall = true;
      if (API_BASE) {
        const url = new URL(input.url);
        input = new Request(
          `${API_BASE}${url.pathname}${url.search}${url.hash}`,
          input,
        );
      }
    }

    let response: Response;
    try {
      response = await originalFetch(input, init);
    } catch (err) {
      // Network error — return a synthetic JSON error response for API calls
      if (isApiCall) {
        return new Response(
          JSON.stringify({ error: "Network error", detail: String(err) }),
          { status: 0, headers: { "Content-Type": "application/json" } },
        );
      }
      throw err;
    }

    // For API calls, ensure error responses are JSON (not HTML error pages)
    if (isApiCall && !response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        // Backend or proxy returned an HTML error page — convert to JSON
        return new Response(
          JSON.stringify({ error: `API error ${response.status}`, status: response.status }),
          {
            status: response.status,
            statusText: response.statusText,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    return response;
  } as typeof window.fetch;
}
