"use server";

import { headers } from "next/headers";
import { ipAddress } from "@vercel/functions";
import { requestOtp } from "@/lib/domain/otp";
import { checkRateLimit } from "@/lib/domain/rate-limit";
import { redisRateLimitStore } from "@/lib/infra/rateLimitStore";
import { redisOtpStore } from "@/lib/infra/otpStore";
import { twilioOtpSender } from "@/lib/infra/twilio";
import { findDonorById } from "@/lib/infra/repositories/donorRepository";

const REQUEST_DONOR_OTP_RATE_LIMIT_CONFIG = {
  maxRequests: Number(process.env.RATE_LIMIT_OTP_MAX ?? 5),
  windowSeconds: Number(process.env.RATE_LIMIT_OTP_WINDOW_SECONDS ?? 60),
};

interface ActionError {
  error: {
    code: string;
    message: string;
  };
}

interface ActionSuccess {
  requested: true;
}

export type RequestDonorOtpResult = ActionSuccess | ActionError;

export async function requestDonorOtp(
  input: { donorId: string },
): Promise<RequestDonorOtpResult> {
  const ip = ipAddress(await headers()) ?? "unknown";
  const rateLimitResult = await checkRateLimit(
    { ip, endpoint: "requestDonorOtp" },
    redisRateLimitStore,
    REQUEST_DONOR_OTP_RATE_LIMIT_CONFIG,
  );

  if (!rateLimitResult.allowed) {
    return {
      error: {
        code: "RATE_LIMITED",
        message: "Too many attempts. Please try again shortly.",
      },
    };
  }

  const donor = await findDonorById(input.donorId);
  if (!donor) {
    return {
      error: { code: "NOT_FOUND", message: "We couldn't find that registration." },
    };
  }

  await requestOtp(
    { phone: donor.phone, purpose: "donor_registration" },
    redisOtpStore,
    twilioOtpSender,
  );

  return { requested: true };
}
