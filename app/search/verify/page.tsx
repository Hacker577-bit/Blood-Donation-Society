"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/Button";
import { InputField } from "@/app/components/ui/InputField";
import { OtpInput } from "@/app/components/ui/OtpInput";
import {
  searcherVerifySchema,
  type SearcherVerifyInput,
} from "@/lib/validation/searcherVerify";
import { requestSearcherOtp } from "@/app/actions/requestSearcherOtp";
import { verifySearcherOtp } from "@/app/actions/verifySearcherOtp";

const RESEND_COUNTDOWN_SECONDS = 45;

type FieldName = keyof SearcherVerifyInput;
type Step = "details" | "otp";

interface FormState {
  name: string;
  phone: string;
}

const initialState: FormState = { name: "", phone: "" };

export default function SearcherVerifyPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState<FormState>(initialState);
  const [touchedFields, setTouchedFields] = useState<Set<FieldName>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmittingDetails, setIsSubmittingDetails] = useState(false);

  const [code, setCode] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(RESEND_COUNTDOWN_SECONDS);

  const validationResult = useMemo(() => searcherVerifySchema.safeParse(form), [form]);
  const isValid = validationResult.success;

  // Re-check every already-touched field whenever the form changes, so a
  // previously-shown inline error clears the moment its value becomes valid
  // (not just on the next blur). Untouched fields are never validated early.
  useEffect(() => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const field of touchedFields) {
        if (validationResult.success) {
          next[field] = undefined;
          continue;
        }
        const issue = validationResult.error.issues.find((i) => i.path[0] === field);
        next[field] = issue?.message;
      }
      return next;
    });
  }, [validationResult, touchedFields]);

  function markTouched(field: FieldName) {
    setTouchedFields((prev) => new Set(prev).add(field));
  }

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!isValid) {
      return;
    }

    setIsSubmittingDetails(true);
    try {
      const result = await requestSearcherOtp({ name: form.name, phone: form.phone });

      if ("error" in result) {
        setSubmitError(result.error.message);
        if (result.error.fieldErrors) {
          setFieldErrors((prev) => ({ ...prev, ...result.error.fieldErrors }));
        }
        return;
      }

      setResendSecondsLeft(RESEND_COUNTDOWN_SECONDS);
      setStep("otp");
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setIsSubmittingDetails(false);
    }
  }

  async function sendCode() {
    setIsSending(true);
    setErrorCode(null);
    setErrorMessage(null);
    try {
      const result = await requestSearcherOtp({ name: form.name, phone: form.phone });
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
      const result = await verifySearcherOtp({ phone: form.phone, code });
      if ("error" in result) {
        setErrorCode(result.error.code);
        setErrorMessage(result.error.message);
        return;
      }
      const params = new URLSearchParams({
        sessionToken: result.sessionToken,
        name: form.name,
      });
      router.push(`/search?${params.toString()}`);
    } finally {
      setIsVerifying(false);
    }
  }

  const canResend = resendSecondsLeft <= 0 && !isSending;

  if (step === "details") {
    return (
      <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8">
        <h1 className="text-heading text-ink-primary">Verify your identity</h1>

        <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-6" noValidate>
          <InputField
            id="name"
            label="Name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            onBlur={() => markTouched("name")}
            error={fieldErrors.name}
          />

          <InputField
            id="phone"
            label="Phone number"
            placeholder="+923001234567"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            onBlur={() => markTouched("phone")}
            error={fieldErrors.phone}
          />

          {submitError && (
            <p role="alert" className="text-meta text-status-error">
              {submitError}
            </p>
          )}

          <Button disabled={!isValid} loading={isSubmittingDetails}>
            Submit
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
        {errorCode === "RATE_LIMITED" && (
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
