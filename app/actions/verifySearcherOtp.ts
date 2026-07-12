"use server";

import { verifyOtp } from "@/lib/domain/otp";
import { issueSessionToken } from "@/lib/domain/session";
import { redisOtpStore } from "@/lib/infra/otpStore";
import { joseTokenSigner } from "@/lib/infra/jwt";
import { redisSessionBudgetStore } from "@/lib/infra/sessionStore";

const SEARCHER_SESSION_BUDGET = 2;

interface ActionError {
  error: {
    code: string;
    message: string;
  };
}

interface ActionSuccess {
  verified: true;
  sessionToken: string;
}

export type VerifySearcherOtpResult = ActionSuccess | ActionError;

export async function verifySearcherOtp(
  input: { phone: string; code: string },
): Promise<VerifySearcherOtpResult> {
  const { status } = await verifyOtp(
    { phone: input.phone, purpose: "searcher_verify", code: input.code },
    redisOtpStore,
  );

  switch (status) {
    case "verified": {
      const { token } = await issueSessionToken(
        { subject: input.phone, budget: SEARCHER_SESSION_BUDGET },
        joseTokenSigner,
        redisSessionBudgetStore,
      );
      return { verified: true, sessionToken: token };
    }
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
