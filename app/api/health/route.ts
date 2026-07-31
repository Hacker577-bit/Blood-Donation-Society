import { prisma } from "@/lib/infra/prisma";
import { redis } from "@/lib/infra/redis";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  checks: Record<string, { status: "ok" | "error"; error?: string }>;
}

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const checks: HealthStatus["checks"] = {};
  let overall: HealthStatus["status"] = "healthy";

  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok" };
  } catch (err) {
    checks.database = {
      status: "error",
      error: err instanceof Error ? err.message : "Unknown database error",
    };
    overall = "unhealthy";
  }
  const dbDuration = Date.now() - dbStart;

  const redisStart = Date.now();
  try {
    await redis.ping();
    checks.redis = { status: "ok" };
  } catch (err) {
    checks.redis = {
      status: "error",
      error: err instanceof Error ? err.message : "Unknown redis error",
    };
    if (overall !== "unhealthy") {
      overall = "degraded";
    }
  }
  const redisDuration = Date.now() - redisStart;

  return NextResponse.json(
    {
      status: overall,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    },
    { status: overall === "healthy" ? 200 : overall === "degraded" ? 200 : 503 },
  );
}
