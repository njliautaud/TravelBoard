// Hosts blocked from /api/cover-proxy to avoid SSRF into local/private networks.
// (The proxy otherwise fetches arbitrary public image hosts so Google-image
// results from any site load reliably with a browser User-Agent.)
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^0\.0\.0\.0$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/i,
  /^fe80:/i,
  /^f[cd][0-9a-f]{2}:/i,
];

export function isBlockedProxyHost(hostname: string): boolean {
  const h = hostname.replace(/^\[/, "").replace(/\]$/, "");
  return BLOCKED_HOST_PATTERNS.some((re) => re.test(h));
}

export function coverProxyPath(url: string, width = 480): string {
  return `/api/cover-proxy?url=${encodeURIComponent(url)}&w=${width}`;
}
