import { redis } from "@/lib/infra/redis";
import type { SessionBudgetStore } from "@/lib/domain/session";

export const redisSessionBudgetStore: SessionBudgetStore = {
  async initialize(jti, budget, ttlSeconds) {
    await redis.set(jti, budget, { ex: ttlSeconds });
  },

  async consume(jti) {
    const exists = await redis.get(jti);
    if (exists === null) {
      return null;
    }

    const remaining = await redis.decr(jti);
    return { allowed: remaining >= 0, remaining: Math.max(remaining, 0) };
  },
};
