import { describe, expect, it, vi, beforeEach } from "vitest";

const requestOtpMock = vi.fn();
const findDonorByPhoneMock = vi.fn();

let currentTestIp = "198.51.100.1";
let ipCounter = 0;

vi.mock("@/lib/domain/otp", () => ({
  requestOtp: (...args: unknown[]) => requestOtpMock(...args),
}));

vi.mock("@/lib/infra/repositories/donorRepository", () => ({
  findDonorByPhone: (...args: unknown[]) => findDonorByPhoneMock(...args),
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

import { requestSelfServiceOtp } from "./requestSelfServiceOtp";

const verifiedDonor = {
  id: "donor_1",
  phone: "+923001234567",
  isVerified: true,
};

describe("requestSelfServiceOtp server action", () => {
  beforeEach(() => {
    requestOtpMock.mockReset();
    findDonorByPhoneMock.mockReset();
    findDonorByPhoneMock.mockResolvedValue(verifiedDonor);
    currentTestIp = `198.51.100.${++ipCounter}`;
  });

  it("requests an OTP for the self_service purpose when the phone belongs to a verified donor", async () => {
    const result = await requestSelfServiceOtp({ phone: "+923001234567" });

    expect(result).toEqual({ requested: true });
    expect(requestOtpMock).toHaveBeenCalledTimes(1);
    expect(requestOtpMock.mock.calls[0][0]).toEqual({
      phone: "+923001234567",
      purpose: "self_service",
    });
  });

  it("looks the donor up by the trimmed, Zod-parsed phone so the lookup key matches the OTP key", async () => {
    await requestSelfServiceOtp({ phone: "  +923001234567  " });

    expect(findDonorByPhoneMock).toHaveBeenCalledWith("+923001234567");
    expect(requestOtpMock.mock.calls[0][0]).toEqual({
      phone: "+923001234567",
      purpose: "self_service",
    });
  });

  it("returns { requested: true } and sends no SMS for an unregistered phone, so the endpoint cannot enumerate donors", async () => {
    findDonorByPhoneMock.mockResolvedValue(null);

    const result = await requestSelfServiceOtp({ phone: "+923009999999" });

    expect(result).toEqual({ requested: true });
    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it("returns { requested: true } and sends no SMS for an unverified donor", async () => {
    findDonorByPhoneMock.mockResolvedValue({
      id: "donor_2",
      phone: "+923011234567",
      isVerified: false,
    });

    const result = await requestSelfServiceOtp({ phone: "+923011234567" });

    expect(result).toEqual({ requested: true });
    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it("never leaks NOT_FOUND — the unregistered response is byte-identical to the success response", async () => {
    const registered = await requestSelfServiceOtp({ phone: "+923001234567" });

    findDonorByPhoneMock.mockResolvedValue(null);
    const unregistered = await requestSelfServiceOtp({ phone: "+923009999999" });

    expect(unregistered).toEqual(registered);
  });

  it("returns VALIDATION_ERROR with fieldErrors and does not request an OTP for a malformed phone", async () => {
    const result = await requestSelfServiceOtp({ phone: "not-a-phone" });

    expect(result).toMatchObject({
      error: { code: "VALIDATION_ERROR", fieldErrors: { phone: expect.any(String) } },
    });
    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it("does not require a name, unlike the searcher flow", async () => {
    const result = await requestSelfServiceOtp({ phone: "+923001234567" });

    expect(result).toEqual({ requested: true });
  });

  it("returns RATE_LIMITED once the same IP exceeds the threshold", async () => {
    currentTestIp = "203.0.113.221";
    const input = { phone: "+923001234567" };

    for (let i = 0; i < 5; i++) {
      await requestSelfServiceOtp(input);
    }
    requestOtpMock.mockClear();

    const sixth = await requestSelfServiceOtp(input);

    expect(sixth).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect(requestOtpMock).not.toHaveBeenCalled();
  });

  it("rate-limits before validating, so malformed input still costs the attacker a slot", async () => {
    currentTestIp = "203.0.113.222";

    for (let i = 0; i < 5; i++) {
      await requestSelfServiceOtp({ phone: "not-a-phone" });
    }

    const sixth = await requestSelfServiceOtp({ phone: "+923001234567" });

    expect(sixth).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect(findDonorByPhoneMock).not.toHaveBeenCalled();
  });

  it("also rate-limits resends, since Resend calls this same action again", async () => {
    currentTestIp = "203.0.113.223";
    const input = { phone: "+923001234567" };

    for (let i = 0; i < 6; i++) {
      await requestSelfServiceOtp(input);
    }
    const resend = await requestSelfServiceOtp(input);

    expect(resend).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });
});
