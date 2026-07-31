import { redis } from "@/lib/infra/redis";
import { memoryRateLimitStore } from "@/lib/infra/memoryStores";
import { pgRateLimitStore } from "@/lib/infra/pgStores";
import type { RateLimitCounterStore } from "@/lib/domain/rate-limit";
import { logger } from "@/lib/infra/logger";

const hasRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL);
const hasDatabase = Boolean(process.env.DATABASE_URL);

const redisImpl: RateLimitCounterStore = {
  async recordAndCount(key, windowSeconds) {
    try {
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
    } catch (err) {
      logger.error("rateLimitStore: Redis operation failed, allowing request through", {
        error: err instanceof Error ? err.message : "unknown",
        key,
      });
      return { count: 0, oldestTimestampMs: null };
    }
  },
};

export const redisRateLimitStore: RateLimitCounterStore = hasRedis
  ? redisImpl
  : hasDatabase
    ? pgRateLimitStore
    : memoryRateLimitStore;
