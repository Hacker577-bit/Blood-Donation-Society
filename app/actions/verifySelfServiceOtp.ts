"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyOtp } from "@/lib/domain/otp";
import { issueSessionToken } from "@/lib/domain/session";
import { redisOtpStore } from "@/lib/infra/otpStore";
import { joseTokenSigner } from "@/lib/infra/jwt";
import { redisSessionBudgetStore } from "@/lib/infra/sessionStore";
import { findDonorByPhone } from "@/lib/infra/repositories/donorRepository";

const SELF_SERVICE_SESSION_BUDGET = 1;

// Matches SESSION_TTL_SECONDS in lib/domain/session.ts, which is module-private.
const SELF_SERVICE_COOKIE_MAX_AGE = 900;

interface ActionError {
  error: {
    code: string;
    message: string;
  };
}

export type VerifySelfServiceOtpResult = ActionError;

export async function verifySelfServiceOtp(
  input: { phone: string; code: string },
): Promise<VerifySelfServiceOtpResult> {
  const { status } = await verifyOtp(
    { phone: input.phone, purpose: "self_service", code: input.code },
    redisOtpStore,
  );

  switch (status) {
    case "verified": {
      // Re-look up rather than trusting the client: the token subject must be
      // the Donor id, and the row can legitimately vanish between request and
      // verify once Story 3.3 ships deletion.
      const donor = await findDonorByPhone(input.phone);

      if (!donor) {
        return {
          error: { code: "NOT_FOUND", message: "We couldn't find that registration." },
        };
      }

      const { token } = await issueSessionToken(
        { subject: donor.id, budget: SELF_SERVICE_SESSION_BUDGET },
        joseTokenSigner,
        redisSessionBudgetStore,
      );

      // path: "/manage" is deliberate — RFC 6265 §5.1.4 prefix-matching sends
      // this to /manage/dashboard too. The narrower path is the point.
      (await cookies()).set("self_service_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/manage",
        maxAge: SELF_SERVICE_COOKIE_MAX_AGE,
      });

      // Redirect from inside the action so Set-Cookie and the navigation ride
      // one response. A client-side router.push() here races the cookie commit
      // (vercel/next.js#49675) and bounces the donor back to /manage forever.
      // redirect() throws by design — it must stay outside any try/catch.
      redirect("/manage/dashboard");
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
