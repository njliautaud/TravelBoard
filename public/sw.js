/*
 * TravelBoard service worker — offline app shell + map/terrain tile caching.
 *
 * Registered ONLY in production builds (see ServiceWorkerRegistrar), so it never
 * touches the `next dev` servers. Strategy is chosen to avoid stale-version
 * lockout: navigations + API are network-first (always fresh when online),
 * content-hashed Next assets are cache-first (safe — new build = new URLs), and
 * map tiles are cache-first (instant re-zoom + offline for any area you've seen).
 *
 * Bump VERSION to roll all caches.
 */
const VERSION = "v1";
const APP_CACHE = `tb-app-${VERSION}`;
const TILE_CACHE = `tb-tiles-${VERSION}`;
const API_CACHE = `tb-api-${VERSION}`;
const TILE_MAX = 1500; // cap tile entries so the cache can't grow unbounded

// Hosts whose responses are map basemap / DEM terrain tiles.
const TILE_HOST_RE = /(^|\.)cartocdn\.com$|(^|\.)?elevation-tiles-prod\.s3\.amazonaws\.com$|^s3\.amazonaws\.com$/;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older versions.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isTileRequest(url) {
  if (!TILE_HOST_RE.test(url.hostname)) return false;
  // The s3.amazonaws.com host only counts when it's the terrarium DEM path.
  if (url.hostname === "s3.amazonaws.com") return url.pathname.includes("elevation-tiles-prod");
  return true;
}

// Keep a cache under a max entry count (oldest-first eviction).
async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(req, cacheName, opts) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) {
      await cache.put(req, res.clone());
      if (opts && opts.max) trimCache(cacheName, opts.max);
    }
    return res;
  } catch (err) {
    return hit || Response.error();
  }
}

async function networkFirst(req, cacheName, fallbackPath) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(req)) || (fallbackPath ? await cache.match(fallbackPath) : null);
    return hit || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache mutations (offline writes = Phase 3 outbox)

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // 1) Map basemap + DEM terrain tiles → cache-first (no zoom buffer + offline).
  if (isTileRequest(url)) {
    event.respondWith(cacheFirst(req, TILE_CACHE, { max: TILE_MAX }));
    return;
  }

  // Only manage our own origin beyond this point.
  if (url.origin !== self.location.origin) return;

  // 2) Content-hashed Next assets → cache-first (immutable).
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/favicon.ico") {
    event.respondWith(cacheFirst(req, APP_CACHE));
    return;
  }

  // 3) API reads → network-first, fall back to the last cached response offline.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  // 4) Page navigations → network-first, fall back to cached shell for offline boot.
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, APP_CACHE, "/"));
    return;
  }
});
