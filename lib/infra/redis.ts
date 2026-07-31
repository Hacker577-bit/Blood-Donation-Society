import { Redis } from "@upstash/redis";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

function getRedis(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = Redis.fromEnv();
    if (process.env.NODE_ENV !== "production") {
      globalForRedis.redis = globalForRedis.redis;
    }
  }
  return globalForRedis.redis;
}

export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    return getRedis()[prop as keyof Redis];
  },
});
