import { describe, expect, it, vi, beforeEach } from "vitest";

const findDonorByIdMock = vi.fn();
const requestOtpMock = vi.fn();

let currentTestIp = "198.51.100.1";
let ipCounter = 0;

vi.mock("@/lib/infra/repositories/donorRepository", () => ({
  findDonorById: (...args: unknown[]) => findDonorByIdMock(...args),
}));

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

import { requestDonorOtp } from "./requestDonorOtp";

describe("requestDonorOtp server action", () => {
  beforeEach(() => {
    findDonorByIdMock.mockReset();
    requestOtpMock.mockReset();
    currentTestIp = `198.51.100.${++ipCounter}`;
  });

  it("looks up the donor's phone and requests an OTP for the donor_registration purpose", async () => {
    findDonorByIdMock.mockResolvedValue({
      id: "donor_1",
      phone: "+923001234567",
      isVerified: false,
    });

    const result = await requestDonorOtp({ donorId: "donor_1" });

    expect(result).toEqual({ requested: true });
    expect(requestOtpMock).toHaveBeenCalledTimes(1);
    expect(requestOtpMock.mock.calls[0][0]).toEqual({
      phone: "+923001234567",
      purpose: "donor_registration",
    });
  });

  it("returns a structured NOT_FOUND error and does not request an OTP for an unknown donorId", async () => {
    findDonorByIdMock.mockResolvedValue(null);

    const result = await requestDonorOtp({ donorId: "does-not-exist" });

    expect(result).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED and does not call findDonorById once the same IP exceeds the threshold", async () => {
    currentTestIp = "203.0.113.211";
    findDonorByIdMock.mockResolvedValue({
      id: "donor_1",
      phone: "+923001234567",
      isVerified: false,
    });

    for (let i = 0; i < 5; i++) {
      await requestDonorOtp({ donorId: "donor_1" });
    }
    findDonorByIdMock.mockClear();

    const sixth = await requestDonorOtp({ donorId: "donor_1" });

    expect(sixth).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect(findDonorByIdMock).not.toHaveBeenCalled();
  });

  it("also rate-limits resends, since Resend calls this same action again", async () => {
    currentTestIp = "203.0.113.212";
    findDonorByIdMock.mockResolvedValue({
      id: "donor_1",
      phone: "+923001234567",
      isVerified: false,
    });

    for (let i = 0; i < 6; i++) {
      await requestDonorOtp({ donorId: "donor_1" });
    }
    const resend = await requestDonorOtp({ donorId: "donor_1" });

    expect(resend).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });
});
