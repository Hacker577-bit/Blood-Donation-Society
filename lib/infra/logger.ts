type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  durationMs?: number;
  error?: string;
  [key: string]: unknown;
}

const isProd = process.env.NODE_ENV === "production";

function formatLog(entry: LogEntry): string {
  if (isProd) {
    return JSON.stringify(entry);
  }

  const parts = [`[${entry.timestamp}]`];
  parts.push(`[${entry.level.toUpperCase()}]`);
  parts.push(entry.message);

  const extras: Record<string, unknown> = {};
  for (const key of Object.keys(entry)) {
    if (key !== "level" && key !== "message" && key !== "timestamp") {
      extras[key] = entry[key];
    }
  }

  const extraKeys = Object.keys(extras);
  if (extraKeys.length > 0) {
    parts.push(JSON.stringify(extras));
  }

  return parts.join(" ");
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    console.log(formatLog(entry));
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: "warn",
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    console.warn(formatLog(entry));
  },

  error(message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    console.error(formatLog(entry));
  },
};
