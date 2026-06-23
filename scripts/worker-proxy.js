// Cloudflare Worker: permanent API proxy for TravelBoard
// URL: https://travelboard-api.relentlessrobotics.workers.dev
// Proxies all requests to Jupiter's cloudflared tunnel.
// The TUNNEL_URL env var is updated automatically when the tunnel restarts.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const tunnelUrl = env.TUNNEL_URL || "https://prevent-substance-entrance-kick.trycloudflare.com";
    const targetUrl = tunnelUrl + url.pathname + url.search;

    // Build proxied request
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    });

    // Forward to Jupiter backend
    let response;
    try {
      response = await fetch(proxyRequest);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Backend unavailable", detail: e.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Clone response with CORS headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    newHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: newHeaders });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
