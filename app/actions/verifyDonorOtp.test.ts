import { describe, expect, it, vi, beforeEach } from "vitest";

const findDonorByIdMock = vi.fn();
const activateDonorMock = vi.fn();
const verifyOtpMock = vi.fn();

vi.mock("@/lib/infra/repositories/donorRepository", () => ({
  findDonorById: (...args: unknown[]) => findDonorByIdMock(...args),
  activateDonor: (...args: unknown[]) => activateDonorMock(...args),
}));

vi.mock("@/lib/domain/otp", () => ({
  verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
}));

vi.mock("@/lib/infra/otpStore", () => ({ redisOtpStore: {} }));

import { verifyDonorOtp } from "./verifyDonorOtp";

describe("verifyDonorOtp server action", () => {
  beforeEach(() => {
    findDonorByIdMock.mockReset();
    activateDonorMock.mockReset();
    verifyOtpMock.mockReset();
    findDonorByIdMock.mockResolvedValue({
      id: "donor_1",
      phone: "+923001234567",
      isVerified: false,
    });
  });

  it("activates the donor and returns verified on the happy path", async () => {
    verifyOtpMock.mockResolvedValue({ status: "verified" });

    const result = await verifyDonorOtp({ donorId: "donor_1", code: "123456" });

    expect(result).toEqual({ verified: true });
    expect(activateDonorMock).toHaveBeenCalledWith("donor_1");
  });

  it("returns a structured NOT_FOUND error for an unknown donorId and never calls verifyOtp", async () => {
    findDonorByIdMock.mockResolvedValue(null);

    const result = await verifyDonorOtp({ donorId: "does-not-exist", code: "123456" });

    expect(result).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(activateDonorMock).not.toHaveBeenCalled();
  });

  it("returns OTP_EXPIRED and does not activate the donor when the code has expired", async () => {
    verifyOtpMock.mockResolvedValue({ status: "expired" });

    const result = await verifyDonorOtp({ donorId: "donor_1", code: "123456" });

    expect(result).toMatchObject({
      error: { code: "OTP_EXPIRED", message: "This code has expired." },
    });
    expect(activateDonorMock).not.toHaveBeenCalled();
  });

  it("treats a not_found challenge the same as expired", async () => {
    verifyOtpMock.mockResolvedValue({ status: "not_found" });

    const result = await verifyDonorOtp({ donorId: "donor_1", code: "123456" });

    expect(result).toMatchObject({
      error: { code: "OTP_EXPIRED", message: "This code has expired." },
    });
  });

  it("returns OTP_INCORRECT for a wrong, non-expired code, distinct from the expired message", async () => {
    verifyOtpMock.mockResolvedValue({ status: "wrong_code" });

    const result = await verifyDonorOtp({ donorId: "donor_1", code: "000000" });

    expect(result).toMatchObject({
      error: {
        code: "OTP_INCORRECT",
        message: "That code didn't match. Check the SMS and try again.",
      },
    });
    expect(activateDonorMock).not.toHaveBeenCalled();
  });
});
