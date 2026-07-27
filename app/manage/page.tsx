"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/app/components/ui/Button";
import { InputField } from "@/app/components/ui/InputField";
import { OtpInput } from "@/app/components/ui/OtpInput";
import { selfServiceEntrySchema } from "@/lib/validation/selfServiceEntry";
import { requestSelfServiceOtp } from "@/app/actions/requestSelfServiceOtp";
import { verifySelfServiceOtp } from "@/app/actions/verifySelfServiceOtp";

const RESEND_COUNTDOWN_SECONDS = 45;

type Step = "entry" | "otp";

export default function ManagePage() {
  const [step, setStep] = useState<Step>("entry");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmittingEntry, setIsSubmittingEntry] = useState(false);

  const [code, setCode] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(RESEND_COUNTDOWN_SECONDS);

  const validationResult = useMemo(
    () => selfServiceEntrySchema.safeParse({ phone }),
    [phone],
  );
  const isValid = validationResult.success;

  // Re-check the phone once it has been touched, so a shown inline error
  // clears the moment the value becomes valid rather than on the next blur.
  useEffect(() => {
    if (!phoneTouched) {
      return;
    }
    if (validationResult.success) {
      setPhoneError(undefined);
      return;
    }
    setPhoneError(
      validationResult.error.issues.find((i) => i.path[0] === "phone")?.message,
    );
  }, [validationResult, phoneTouched]);

  async function handleEntrySubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!isValid) {
      return;
    }

    setIsSubmittingEntry(true);
    try {
      const result = await requestSelfServiceOtp({ phone });

      if ("error" in result) {
        setSubmitError(result.error.message);
        if (result.error.fieldErrors?.phone) {
          setPhoneError(result.error.fieldErrors.phone);
        }
        return;
      }

      setResendSecondsLeft(RESEND_COUNTDOWN_SECONDS);
      setStep("otp");
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setIsSubmittingEntry(false);
    }
  }

  async function sendCode() {
    setIsSending(true);
    setErrorCode(null);
    setErrorMessage(null);
    try {
      const result = await requestSelfServiceOtp({ phone });
      if ("error" in result) {
        setErrorCode(result.error.code);
        setErrorMessage(result.error.message);
      } else {
        setResendSecondsLeft(RESEND_COUNTDOWN_SECONDS);
      }
    } finally {
      setIsSending(false);
    }
  }

  useEffect(() => {
    if (step !== "otp" || resendSecondsLeft <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setResendSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, resendSecondsLeft]);

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      return;
    }

    setIsVerifying(true);
    setErrorCode(null);
    setErrorMessage(null);
    try {
      // On success this never returns — the action sets the session cookie and
      // redirects to /manage/dashboard in the same response. Only failures
      // reach the code below.
      const result = await verifySelfServiceOtp({ phone, code });
      if ("error" in result) {
        setErrorCode(result.error.code);
        setErrorMessage(result.error.message);
      }
    } catch {
      setErrorCode("UNEXPECTED");
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  }

  const canResend = resendSecondsLeft <= 0 && !isSending;

  if (step === "entry") {
    return (
      <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8">
        <h1 className="text-heading text-ink-primary">Manage your registration</h1>
        <p className="text-body text-ink-secondary">
          Enter the phone number you registered with and we&apos;ll send you a code.
        </p>

        <form onSubmit={handleEntrySubmit} className="flex flex-col gap-6" noValidate>
          <InputField
            id="phone"
            label="Phone number"
            placeholder="+923001234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setPhoneTouched(true)}
            error={phoneError}
          />

          {submitError && (
            <p role="alert" className="text-meta text-status-error">
              {submitError}
            </p>
          )}

          <Button disabled={!isValid} loading={isSubmittingEntry}>
            Send code
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8 motion-reduce:transition-none">
      <h1 className="text-heading text-ink-primary">Verify your phone</h1>
      <p className="text-body text-ink-secondary">
        Enter the 6-digit code we sent to your phone.
      </p>

      <form onSubmit={handleOtpSubmit} className="flex flex-col gap-6" noValidate>
        <OtpInput value={code} onChange={setCode} disabled={isSending || isVerifying} />

        {errorCode === "OTP_EXPIRED" && (
          <p role="alert" className="text-meta text-status-error">
            {errorMessage}
          </p>
        )}
        {errorCode === "OTP_INCORRECT" && (
          <p role="alert" className="text-meta text-status-error">
            {errorMessage}
          </p>
        )}
        {errorCode === "NOT_FOUND" && (
          <p role="alert" className="text-meta text-status-error">
            {errorMessage}
          </p>
        )}
        {errorCode === "RATE_LIMITED" && (
          <p role="alert" className="text-meta text-status-error">
            {errorMessage}
          </p>
        )}
        {errorCode === "UNEXPECTED" && (
          <p role="alert" className="text-meta text-status-error">
            {errorMessage}
          </p>
        )}

        <Button disabled={code.length !== 6 || isSending} loading={isVerifying}>
          Verify
        </Button>

        {canResend ? (
          <button
            type="button"
            data-testid="resend-control"
            onClick={sendCode}
            className="inline-flex min-h-[44px] items-center text-meta text-accent underline-offset-2 hover:underline"
          >
            Resend code
          </button>
        ) : (
          <span
            data-testid="resend-control"
            className="inline-flex min-h-[44px] items-center text-meta text-ink-disabled"
          >
            Resend in 0:{resendSecondsLeft.toString().padStart(2, "0")}
          </span>
        )}

        {/* The request endpoint is deliberately enumeration-resistant (AC #2),
            so an unregistered phone reaches this step and waits for an SMS that
            will never arrive. This is the only exit from that dead end. */}
        {resendSecondsLeft <= 0 && (
          <p className="text-meta text-ink-secondary">
            <span>
              Didn&apos;t get a code? This number may not have a verified registration.
            </span>{" "}
            <Link href="/register" className="text-accent underline-offset-2 hover:underline">
              Register instead
            </Link>
          </p>
        )}
      </form>
    </main>
  );
}
