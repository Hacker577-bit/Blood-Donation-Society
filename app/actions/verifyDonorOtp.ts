"use server";

import { verifyOtp } from "@/lib/domain/otp";
import { redisOtpStore } from "@/lib/infra/otpStore";
import { findDonorById, activateDonor } from "@/lib/infra/repositories/donorRepository";

interface ActionError {
  error: {
    code: string;
    message: string;
  };
}

interface ActionSuccess {
  verified: true;
}

export type VerifyDonorOtpResult = ActionSuccess | ActionError;

export async function verifyDonorOtp(
  input: { donorId: string; code: string },
): Promise<VerifyDonorOtpResult> {
  const donor = await findDonorById(input.donorId);
  if (!donor) {
    return {
      error: { code: "NOT_FOUND", message: "We couldn't find that registration." },
    };
  }

  const { status } = await verifyOtp(
    { phone: donor.phone, purpose: "donor_registration", code: input.code },
    redisOtpStore,
  );

  switch (status) {
    case "verified":
      await activateDonor(donor.id);
      return { verified: true };
    case "expired":
    case "not_found":
      return {
        error: { code: "OTP_EXPIRED", message: "This code has expired." },
      };
    case "wrong_code":
      return {
        error: {
          code: "OTP_INCORRECT",
          message: "That code didn't match. Check the SMS and try again.",
        },
      };
  }
}
