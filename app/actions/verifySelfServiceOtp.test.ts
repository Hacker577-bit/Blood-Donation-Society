import { describe, expect, it, vi, beforeEach } from "vitest";

const verifyOtpMock = vi.fn();
const issueSessionTokenMock = vi.fn();
const findDonorByPhoneMock = vi.fn();
const cookieSetMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("@/lib/domain/otp", () => ({
  verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
}));

vi.mock("@/lib/domain/session", () => ({
  issueSessionToken: (...args: unknown[]) => issueSessionTokenMock(...args),
}));

vi.mock("@/lib/infra/repositories/donorRepository", () => ({
  findDonorByPhone: (...args: unknown[]) => findDonorByPhoneMock(...args),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: (...args: unknown[]) => cookieSetMock(...args) }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectMock(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/infra/otpStore", () => ({ redisOtpStore: {} }));
vi.mock("@/lib/infra/jwt", () => ({ joseTokenSigner: {} }));
vi.mock("@/lib/infra/sessionStore", () => ({ redisSessionBudgetStore: {} }));

import { verifySelfServiceOtp } from "./verifySelfServiceOtp";

const DONOR_ID = "clx0000000000000000000000";

describe("verifySelfServiceOtp server action", () => {
  beforeEach(() => {
    verifyOtpMock.mockReset();
    issueSessionTokenMock.mockReset();
    findDonorByPhoneMock.mockReset();
    cookieSetMock.mockReset();
    redirectMock.mockReset();

    findDonorByPhoneMock.mockResolvedValue({
      id: DONOR_ID,
      phone: "+923001234567",
      isVerified: true,
    });
    issueSessionTokenMock.mockResolvedValue({ token: "signed-jwt-token", jti: "jti-1" });
  });

  it("calls verifyOtp with the self_service purpose", async () => {
    verifyOtpMock.mockResolvedValue({ status: "verified" });

    await expect(
      verifySelfServiceOtp({ phone: "+923001234567", code: "123456" }),
    ).rejects.toThrow("NEXT_REDIRECT:/manage/dashboard");

    expect(verifyOtpMock.mock.calls[0][0]).toEqual({
      phone: "+923001234567",
      purpose: "self_service",
      code: "123456",
    });
  });

  it("issues a session token subject-scoped to the Donor id with a budget of exactly 1", async () => {
    verifyOtpMock.mockResolvedValue({ status: "verified" });

    await expect(
      verifySelfServiceOtp({ phone: "+923001234567", code: "123456" }),
    ).rejects.toThrow("NEXT_REDIRECT:/manage/dashboard");

    expect(issueSessionTokenMock).toHaveBeenCalledTimes(1);
    expect(issueSessionTokenMock.mock.calls[0][0]).toEqual({
      subject: DONOR_ID,
      budget: 1,
    });
  });

  it("never uses the phone as the token subject — a Searcher token must not satisfy findDonorById", async () => {
    verifyOtpMock.mockResolvedValue({ status: "verified" });

    await expect(
      verifySelfServiceOtp({ phone: "+923001234567", code: "123456" }),
    ).rejects.toThrow("NEXT_REDIRECT:/manage/dashboard");

    expect(issueSessionTokenMock.mock.calls[0][0].subject).not.toBe("+923001234567");
  });

  it("stores the token in an httpOnly cookie scoped to /manage, never a query param", async () => {
    verifyOtpMock.mockResolvedValue({ status: "verified" });

    await expect(
      verifySelfServiceOtp({ phone: "+923001234567", code: "123456" }),
    ).rejects.toThrow("NEXT_REDIRECT:/manage/dashboard");

    expect(cookieSetMock).toHaveBeenCalledTimes(1);
    const [name, value, options] = cookieSetMock.mock.calls[0];
    expect(name).toBe("self_service_session");
    expect(value).toBe("signed-jwt-token");
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/manage",
      maxAge: 900,
    });
  });

  it("sets the cookie before redirecting, so Set-Cookie and the navigation ride one response", async () => {
    verifyOtpMock.mockResolvedValue({ status: "verified" });

    await expect(
      verifySelfServiceOtp({ phone: "+923001234567", code: "123456" }),
    ).rejects.toThrow("NEXT_REDIRECT:/manage/dashboard");

    expect(cookieSetMock).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/manage/dashboard");
    expect(cookieSetMock.mock.invocationCallOrder[0]).toBeLessThan(
      redirectMock.mock.invocationCallOrder[0],
    );
  });

  it("returns NOT_FOUND without issuing a token when the donor row vanished between request and verify", async () => {
    verifyOtpMock.mockResolvedValue({ status: "verified" });
    findDonorByPhoneMock.mockResolvedValue(null);

    const result = await verifySelfServiceOtp({ phone: "+923001234567", code: "123456" });

    expect(result).toMatchObject({
      error: { code: "NOT_FOUND", message: "We couldn't find that registration." },
    });
    expect(issueSessionTokenMock).not.toHaveBeenCalled();
    expect(cookieSetMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns OTP_EXPIRED and issues nothing when the code has expired", async () => {
    verifyOtpMock.mockResolvedValue({ status: "expired" });

    const result = await verifySelfServiceOtp({ phone: "+923001234567", code: "123456" });

    expect(result).toMatchObject({
      error: { code: "OTP_EXPIRED", message: "This code has expired." },
    });
    expect(issueSessionTokenMock).not.toHaveBeenCalled();
    expect(cookieSetMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("treats a not_found challenge the same as expired, since verifyOtp deletes on success", async () => {
    verifyOtpMock.mockResolvedValue({ status: "not_found" });

    const result = await verifySelfServiceOtp({ phone: "+923001234567", code: "123456" });

    expect(result).toMatchObject({
      error: { code: "OTP_EXPIRED", message: "This code has expired." },
    });
  });

  it("returns OTP_INCORRECT for a wrong code, distinct from the expired message", async () => {
    verifyOtpMock.mockResolvedValue({ status: "wrong_code" });

    const result = await verifySelfServiceOtp({ phone: "+923001234567", code: "000000" });

    expect(result).toMatchObject({
      error: {
        code: "OTP_INCORRECT",
        message: "That code didn't match. Check the SMS and try again.",
      },
    });
    expect(issueSessionTokenMock).not.toHaveBeenCalled();
    expect(cookieSetMock).not.toHaveBeenCalled();
  });
});
