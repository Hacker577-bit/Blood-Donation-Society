import { describe, expect, it } from "vitest";
import { checkRateLimit, type RateLimitCounterStore } from "./rate-limit";

function createFakeStore(): RateLimitCounterStore & { hits: Map<string, number[]> } {
  const hits = new Map<string, number[]>();
  return {
    hits,
    async recordAndCount(key, windowSeconds) {
      const now = Date.now();
      const windowStart = now - windowSeconds * 1000;
      const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);
      timestamps.push(now);
      hits.set(key, timestamps);
      return { count: timestamps.length, oldestTimestampMs: timestamps[0] ?? null };
    },
  };
}

describe("checkRateLimit", () => {
  it("allows requests at or under the threshold", async () => {
    const store = createFakeStore();
    const config = { maxRequests: 3, windowSeconds: 60 };
    const key = { ip: "203.0.113.4", endpoint: "registerDonor" };

    for (let i = 0; i < 3; i++) {
      const result = await checkRateLimit(key, store, config);
      expect(result.allowed).toBe(true);
    }
  });

  it("rejects the request that crosses the threshold", async () => {
    const store = createFakeStore();
    const config = { maxRequests: 3, windowSeconds: 60 };
    const key = { ip: "203.0.113.4", endpoint: "registerDonor" };

    for (let i = 0; i < 3; i++) {
      await checkRateLimit(key, store, config);
    }
    const fourth = await checkRateLimit(key, store, config);

    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSeconds).toBeGreaterThanOrEqual(0);
  });

  it("treats different ip+endpoint keys independently", async () => {
    const store = createFakeStore();
    const config = { maxRequests: 1, windowSeconds: 60 };

    const first = await checkRateLimit(
      { ip: "203.0.113.4", endpoint: "registerDonor" },
      store,
      config,
    );
    const second = await checkRateLimit(
      { ip: "203.0.113.4", endpoint: "search" },
      store,
      config,
    );
    const third = await checkRateLimit(
      { ip: "203.0.113.5", endpoint: "registerDonor" },
      store,
      config,
    );

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(true);
  });

  it("does not crash and returns a structured result at exactly the boundary", async () => {
    const store = createFakeStore();
    const config = { maxRequests: 0, windowSeconds: 60 };
    const key = { ip: "203.0.113.9", endpoint: "registerDonor" };

    const result = await checkRateLimit(key, store, config);

    expect(result).toEqual({ allowed: false, retryAfterSeconds: expect.any(Number) });
  });
});
