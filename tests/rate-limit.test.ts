import { describe, expect, it } from "vitest";
import { checkRateLimit, pruneRateLimits } from "@/lib/rate-limit";

describe("rate limiting", () => {
  it("allows the configured number and then blocks", () => {
    const hits = new Map<string, { count: number; resetAt: number }>();
    expect(checkRateLimit(hits, "ip", 1_000, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(hits, "ip", 2_000, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(hits, "ip", 3_000, 2, 60_000)).toEqual({ allowed: false, retryAfterSeconds: 58 });
  });

  it("resets after the window and prunes stale keys", () => {
    const hits = new Map<string, { count: number; resetAt: number }>();
    checkRateLimit(hits, "ip", 1_000, 1, 60_000);
    expect(checkRateLimit(hits, "ip", 61_001, 1, 60_000).allowed).toBe(true);
    pruneRateLimits(hits, 200_000);
    expect(hits.size).toBe(0);
  });
});
