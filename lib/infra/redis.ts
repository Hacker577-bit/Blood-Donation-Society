import { Redis } from "@upstash/redis";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

function createRedisClient(): Redis {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set before using the Redis client.",
    );
  }

  return Redis.fromEnv();
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
