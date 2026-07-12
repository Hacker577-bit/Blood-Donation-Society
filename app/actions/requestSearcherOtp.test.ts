import { describe, expect, it, vi, beforeEach } from "vitest";

const requestOtpMock = vi.fn();

let currentTestIp = "198.51.100.1";
let ipCounter = 0;

vi.mock("@/lib/domain/otp", () => ({
  requestOtp: (...args: unknown[]) => requestOtpMock(...args),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@vercel/functions", () => ({
  ipAddress: () => currentTestIp,
}));

vi.mock("@/lib/infra/rateLimitStore", () => {
  const hits = new Map<string, number[]>();
  return {
    redisRateLimitStore: {
      async recordAndCount(key: string, windowSeconds: number) {
        const now = Date.now();
        const windowStart = now - windowSeconds * 1000;
        const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);
        timestamps.push(now);
        hits.set(key, timestamps);
        return { count: timestamps.length, oldestTimestampMs: timestamps[0] ?? null };
      },
    },
  };
});

vi.mock("@/lib/infra/otpStore", () => ({ redisOtpStore: {} }));
vi.mock("@/lib/infra/twilio", () => ({ twilioOtpSender: {} }));

import { requestSearcherOtp } from "./requestSearcherOtp";

describe("requestSearcherOtp server action", () => {
  beforeEach(() => {
    requestOtpMock.mockReset();
    currentTestIp = `198.51.100.${++ipCounter}`;
  });

  it("requests an OTP for the searcher_verify purpose on valid input", async () => {
    const result = await requestSearcherOtp({ name: "Amara Khan", phone: "+923001234567" });

    expect(result).toEqual({ requested: true });
    expect(requestOtpMock).toHaveBeenCalledTimes(1);
    expect(requestOtpMock.mock.calls[0][0]).toEqual({
      phone: "+923001234567",
      purpose: "searcher_verify",
    });
  });

  it("returns VALIDATION_ERROR with fieldErrors and does not request an OTP for an invalid phone", async () => {
    const result = await requestSearcherOtp({ name: "Amara Khan", phone: "not-a-phone" });

    expect(result).toMatchObject({
      error: { code: "VALIDATION_ERROR", fieldErrors: { phone: expect.any(String) } },
    });
    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it("returns VALIDATION_ERROR for a missing name", async () => {
    const result = await requestSearcherOtp({ phone: "+923001234567" });

    expect(result).toMatchObject({
      error: { code: "VALIDATION_ERROR", fieldErrors: { name: expect.any(String) } },
    });
    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED and stops requesting OTPs once the same IP exceeds the threshold", async () => {
    currentTestIp = "203.0.113.211";
    const input = { name: "Amara Khan", phone: "+923001234567" };

    for (let i = 0; i < 5; i++) {
      await requestSearcherOtp(input);
    }
    requestOtpMock.mockClear();

    const sixth = await requestSearcherOtp(input);

    expect(sixth).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it("also rate-limits resends, since Resend calls this same action again", async () => {
    currentTestIp = "203.0.113.212";
    const input = { name: "Amara Khan", phone: "+923001234567" };

    for (let i = 0; i < 6; i++) {
      await requestSearcherOtp(input);
    }
    const resend = await requestSearcherOtp(input);

    expect(resend).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });
});
