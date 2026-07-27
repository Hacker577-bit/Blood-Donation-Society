"use server";

import { headers } from "next/headers";
import { ipAddress } from "@vercel/functions";
import { requestOtp } from "@/lib/domain/otp";
import { checkRateLimit } from "@/lib/domain/rate-limit";
import { redisRateLimitStore } from "@/lib/infra/rateLimitStore";
import { redisOtpStore } from "@/lib/infra/otpStore";
import { twilioOtpSender } from "@/lib/infra/twilio";
import { findDonorByPhone } from "@/lib/infra/repositories/donorRepository";
import { selfServiceEntrySchema } from "@/lib/validation/selfServiceEntry";

const REQUEST_SELF_SERVICE_OTP_RATE_LIMIT_CONFIG = {
  maxRequests: Number(process.env.RATE_LIMIT_OTP_MAX ?? 5),
  windowSeconds: Number(process.env.RATE_LIMIT_OTP_WINDOW_SECONDS ?? 60),
};

interface ActionError {
  error: {
    code: string;
    message: string;
    fieldErrors?: Partial<Record<string, string>>;
  };
}

interface ActionSuccess {
  requested: true;
}

export type RequestSelfServiceOtpResult = ActionSuccess | ActionError;

export async function requestSelfServiceOtp(
  input: unknown,
): Promise<RequestSelfServiceOtpResult> {
  const ip = ipAddress(await headers()) ?? "unknown";
  const rateLimitResult = await checkRateLimit(
    { ip, endpoint: "requestSelfServiceOtp" },
    redisRateLimitStore,
    REQUEST_SELF_SERVICE_OTP_RATE_LIMIT_CONFIG,
  );

  if (!rateLimitResult.allowed) {
    return {
      error: {
        code: "RATE_LIMITED",
        message: "Too many attempts. Please try again shortly.",
      },
    };
  }

  const parsed = selfServiceEntrySchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !(field in fieldErrors)) {
        fieldErrors[field] = issue.message;
      }
    }

    return {
      error: {
        code: "VALIDATION_ERROR",
        message: "Please fix the highlighted fields and try again.",
        fieldErrors,
      },
    };
  }

  const donor = await findDonorByPhone(parsed.data.phone);

  // Enumeration resistance: an absent or unverified registration must be
  // indistinguishable from a real one, so both fall through to the same
  // { requested: true } with no SMS. Returning NOT_FOUND here would turn
  // this endpoint into an oracle for "is this phone number registered?".
  if (!donor || !donor.isVerified) {
    return { requested: true };
  }

  await requestOtp(
    { phone: parsed.data.phone, purpose: "self_service" },
    redisOtpStore,
    twilioOtpSender,
  );

  return { requested: true };
}
