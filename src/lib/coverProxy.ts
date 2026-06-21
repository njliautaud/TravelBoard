/** Hosts allowed for /api/cover-proxy (cover photos & pickers). */
const COVER_HOST_PATTERNS = [
  /^upload\.wikimedia\.org$/i,
  /^commons\.wikimedia\.org$/i,
  /^(.+\.)?wikipedia\.org$/i,
  /^picsum\.photos$/i,
  /^(.+\.)?googleusercontent\.com$/i,
  /^encrypted-tbn\d\.gstatic\.com$/i,
];

export function isAllowedCoverHost(hostname: string): boolean {
  return COVER_HOST_PATTERNS.some((re) => re.test(hostname));
}

export function coverProxyPath(url: string, width = 480): string {
  return `/api/cover-proxy?url=${encodeURIComponent(url)}&w=${width}`;
}
