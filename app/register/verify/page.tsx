"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/app/components/ui/Button";
import { OtpInput } from "@/app/components/ui/OtpInput";
import { requestDonorOtp } from "@/app/actions/requestDonorOtp";
import { verifyDonorOtp } from "@/app/actions/verifyDonorOtp";

const RESEND_COUNTDOWN_SECONDS = 45;

type VerifyErrorCode = "OTP_EXPIRED" | "OTP_INCORRECT" | "RATE_LIMITED" | "NOT_FOUND" | string;

function DonorOtpVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const donorId = searchParams.get("donorId");

  const [code, setCode] = useState("");
  const [isSending, setIsSending] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorCode, setErrorCode] = useState<VerifyErrorCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(RESEND_COUNTDOWN_SECONDS);
  const hasSentInitialCode = useRef(false);

  useEffect(() => {
    if (!donorId) {
      router.replace("/register");
    }
  }, [donorId, router]);

  async function sendCode() {
    if (!donorId) {
      return;
    }
    setIsSending(true);
    setErrorCode(null);
    setErrorMessage(null);
    try {
      const result = await requestDonorOtp({ donorId });
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
    if (donorId && !hasSentInitialCode.current) {
      hasSentInitialCode.current = true;
      sendCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donorId]);

  useEffect(() => {
    if (resendSecondsLeft <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setResendSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSecondsLeft]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!donorId || code.length !== 6) {
      return;
    }

    setIsVerifying(true);
    setErrorCode(null);
    setErrorMessage(null);
    try {
      const result = await verifyDonorOtp({ donorId, code });
      if ("error" in result) {
        setErrorCode(result.error.code);
        setErrorMessage(result.error.message);
        return;
      }
      router.push(`/register/confirmation?donorId=${donorId}`);
    } finally {
      setIsVerifying(false);
    }
  }

  const canResend = resendSecondsLeft <= 0 && !isSending;

  return (
    <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8 motion-reduce:transition-none">
      <h1 className="text-heading text-ink-primary">Verify your phone</h1>
      <p className="text-body text-ink-secondary">
        Enter the 6-digit code we sent to your phone.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
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
        {(errorCode === "RATE_LIMITED" || errorCode === "NOT_FOUND") && (
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
            onClick={sendCode}
            className="text-meta text-accent underline-offset-2 hover:underline"
          >
            Resend code
          </button>
        ) : (
          <span className="text-meta text-ink-disabled">
            Resend in 0:{resendSecondsLeft.toString().padStart(2, "0")}
          </span>
        )}
      </form>
    </main>
  );
}

export default function DonorOtpVerifyPage() {
  return (
    <Suspense fallback={null}>
      <DonorOtpVerifyForm />
    </Suspense>
  );
}
