export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function checkRateLimit(
  hits: Map<string, { count: number; resetAt: number }>,
  key: string,
  now = Date.now(),
  limit = 20,
  windowMs = 60_000,
): RateLimitResult {
  const current = hits.get(key);
  if (!current || current.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)) };
  }
  current.count += 1;
  return { allowed: true };
}

export function pruneRateLimits(hits: Map<string, { count: number; resetAt: number }>, now = Date.now()): void {
  for (const [key, value] of hits) {
    if (value.resetAt <= now) hits.delete(key);
  }
}
