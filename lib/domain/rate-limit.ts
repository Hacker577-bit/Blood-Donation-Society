export interface RateLimitKey {
  ip: string;
  endpoint: string;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitCounterStore {
  /**
   * Records one hit for `key` now and returns the sliding-window count within
   * the trailing `windowSeconds`, plus the oldest hit's timestamp (ms since
   * epoch) still inside that window, or null if this was the only hit.
   */
  recordAndCount(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; oldestTimestampMs: number | null }>;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

function toCompositeKey(key: RateLimitKey): string {
  return `${key.ip}:${key.endpoint}`;
}

export async function checkRateLimit(
  key: RateLimitKey,
  store: RateLimitCounterStore,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const { count, oldestTimestampMs } = await store.recordAndCount(
    toCompositeKey(key),
    config.windowSeconds,
  );

  if (count <= config.maxRequests) {
    return { allowed: true };
  }

  const retryAfterSeconds = oldestTimestampMs
    ? Math.max(
        0,
        Math.ceil(
          (oldestTimestampMs + config.windowSeconds * 1000 - Date.now()) / 1000,
        ),
      )
    : config.windowSeconds;

  return { allowed: false, retryAfterSeconds };
}
