import { prisma } from "@/lib/infra/prisma";
import type { RateLimitCounterStore } from "@/lib/domain/rate-limit";
import { logger } from "@/lib/infra/logger";

export const pgRateLimitStore: RateLimitCounterStore = {
  async recordAndCount(key, windowSeconds) {
    try {
      const now = Date.now();
      const windowStart = now - windowSeconds * 1000;

      await prisma.rateLimitRecord.create({ data: { key } });
      await prisma.rateLimitRecord.deleteMany({
        where: { key, createdAt: { lt: new Date(windowStart) } },
      });

      const [countResult, oldestResult] = await prisma.$transaction([
        prisma.rateLimitRecord.count({ where: { key } }),
        prisma.rateLimitRecord.findFirst({
          where: { key },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);

      return {
        count: countResult,
        oldestTimestampMs: oldestResult ? oldestResult.createdAt.getTime() : null,
      };
    } catch (err) {
      logger.error("pgRateLimitStore: operation failed, allowing request through", {
        error: err instanceof Error ? err.message : "unknown",
        key,
      });
      return { count: 0, oldestTimestampMs: null };
    }
  },
};
