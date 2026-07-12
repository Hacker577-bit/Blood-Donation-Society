"use server";

import { headers } from "next/headers";
import { ipAddress } from "@vercel/functions";
import { requestOtp } from "@/lib/domain/otp";
import { checkRateLimit } from "@/lib/domain/rate-limit";
import { redisRateLimitStore } from "@/lib/infra/rateLimitStore";
import { redisOtpStore } from "@/lib/infra/otpStore";
import { twilioOtpSender } from "@/lib/infra/twilio";
import { searcherVerifySchema } from "@/lib/validation/searcherVerify";

const REQUEST_SEARCHER_OTP_RATE_LIMIT_CONFIG = {
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

export type RequestSearcherOtpResult = ActionSuccess | ActionError;

export async function requestSearcherOtp(
  input: unknown,
): Promise<RequestSearcherOtpResult> {
  const parsed = searcherVerifySchema.safeParse(input);

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

  const ip = ipAddress(await headers()) ?? "unknown";
  const rateLimitResult = await checkRateLimit(
    { ip, endpoint: "requestSearcherOtp" },
    redisRateLimitStore,
    REQUEST_SEARCHER_OTP_RATE_LIMIT_CONFIG,
  );

  if (!rateLimitResult.allowed) {
    return {
      error: {
        code: "RATE_LIMITED",
        message: "Too many attempts. Please try again shortly.",
      },
    };
  }

  await requestOtp(
    { phone: parsed.data.phone, purpose: "searcher_verify" },
    redisOtpStore,
    twilioOtpSender,
  );

  return { requested: true };
}
