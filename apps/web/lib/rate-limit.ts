interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const hits = new Map<string, RateLimitEntry>();

// Shared ceiling for every route in a swarm run. The counter below is ONE cumulative count
// per IP across all routes, so a 20-target run (fleet spawn + per-target search/agent/extract/
// screenshot + releases + a stealth retry + report) can exceed 150 calls in a 60s window. Any
// swarm route with a lower cap becomes the bottleneck and 429s mid-run — so they all use this.
export const SWARM_LIMIT = 300;

export function rateLimit(
  ip: string,
  maxRequests = 30,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  return entry.count <= maxRequests;
}
