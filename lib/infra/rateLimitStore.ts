import { redis } from "@/lib/infra/redis";
import type { RateLimitCounterStore } from "@/lib/domain/rate-limit";

export const redisRateLimitStore: RateLimitCounterStore = {
  async recordAndCount(key, windowSeconds) {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const member = `${now}-${crypto.randomUUID()}`;

    await redis.zadd(key, { score: now, member });
    await redis.zremrangebyscore(key, 0, windowStart);
    await redis.expire(key, windowSeconds);

    const count = await redis.zcard(key);
    const oldest = await redis.zrange<string[]>(key, 0, 0, { withScores: true });
    const oldestTimestampMs = oldest.length > 0 ? Number(oldest[1]) : null;

    return { count, oldestTimestampMs };
  },
};
