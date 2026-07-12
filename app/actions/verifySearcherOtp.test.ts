import { describe, expect, it, vi, beforeEach } from "vitest";

const verifyOtpMock = vi.fn();
const issueSessionTokenMock = vi.fn();

vi.mock("@/lib/domain/otp", () => ({
  verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
}));

vi.mock("@/lib/domain/session", () => ({
  issueSessionToken: (...args: unknown[]) => issueSessionTokenMock(...args),
}));

vi.mock("@/lib/infra/otpStore", () => ({ redisOtpStore: {} }));
vi.mock("@/lib/infra/jwt", () => ({ joseTokenSigner: {} }));
vi.mock("@/lib/infra/sessionStore", () => ({ redisSessionBudgetStore: {} }));

import { verifySearcherOtp } from "./verifySearcherOtp";

describe("verifySearcherOtp server action", () => {
  beforeEach(() => {
    verifyOtpMock.mockReset();
    issueSessionTokenMock.mockReset();
  });

  it("issues a session token scoped to the phone with budget 2 on the happy path", async () => {
    verifyOtpMock.mockResolvedValue({ status: "verified" });
    issueSessionTokenMock.mockResolvedValue({ token: "signed-jwt-token", jti: "jti-1" });

    const result = await verifySearcherOtp({ phone: "+923001234567", code: "123456" });

    expect(result).toEqual({ verified: true, sessionToken: "signed-jwt-token" });
    expect(issueSessionTokenMock).toHaveBeenCalledTimes(1);
    expect(issueSessionTokenMock.mock.calls[0][0]).toEqual({
      subject: "+923001234567",
      budget: 2,
    });
  });

  it("calls verifyOtp with the searcher_verify purpose", async () => {
    verifyOtpMock.mockResolvedValue({ status: "verified" });
    issueSessionTokenMock.mockResolvedValue({ token: "token", jti: "jti-1" });

    await verifySearcherOtp({ phone: "+923001234567", code: "123456" });

    expect(verifyOtpMock.mock.calls[0][0]).toEqual({
      phone: "+923001234567",
      purpose: "searcher_verify",
      code: "123456",
    });
  });

  it("returns OTP_EXPIRED and does not issue a session token when the code has expired", async () => {
    verifyOtpMock.mockResolvedValue({ status: "expired" });

    const result = await verifySearcherOtp({ phone: "+923001234567", code: "123456" });

    expect(result).toMatchObject({
      error: { code: "OTP_EXPIRED", message: "This code has expired." },
    });
    expect(issueSessionTokenMock).not.toHaveBeenCalled();
  });

  it("treats a not_found challenge the same as expired", async () => {
    verifyOtpMock.mockResolvedValue({ status: "not_found" });

    const result = await verifySearcherOtp({ phone: "+923001234567", code: "123456" });

    expect(result).toMatchObject({
      error: { code: "OTP_EXPIRED", message: "This code has expired." },
    });
  });

  it("returns OTP_INCORRECT for a wrong, non-expired code, distinct from the expired message", async () => {
    verifyOtpMock.mockResolvedValue({ status: "wrong_code" });

    const result = await verifySearcherOtp({ phone: "+923001234567", code: "000000" });

    expect(result).toMatchObject({
      error: {
        code: "OTP_INCORRECT",
        message: "That code didn't match. Check the SMS and try again.",
      },
    });
    expect(issueSessionTokenMock).not.toHaveBeenCalled();
  });
});
