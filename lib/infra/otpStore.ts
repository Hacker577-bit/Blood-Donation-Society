import { redis } from "@/lib/infra/redis";
import type { OtpChallenge, OtpChallengeStore } from "@/lib/domain/otp";

function parseChallenge(raw: unknown): OtpChallenge | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === "string") {
    return JSON.parse(raw) as OtpChallenge;
  }
  return raw as OtpChallenge;
}

export const redisOtpStore: OtpChallengeStore = {
  async save(key, value, ttlSeconds) {
    await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
  },

  async get(key) {
    const raw = await redis.get(key);
    return parseChallenge(raw);
  },

  async incrementAttempts(key) {
    const raw = await redis.get(key);
    const existing = parseChallenge(raw);
    if (!existing) {
      return;
    }

    const remainingTtlSeconds = await redis.ttl(key);
    await redis.set(
      key,
      JSON.stringify({ ...existing, attempts: existing.attempts + 1 }),
      { ex: remainingTtlSeconds > 0 ? remainingTtlSeconds : 1 },
    );
  },

  async delete(key) {
    await redis.del(key);
  },
};
