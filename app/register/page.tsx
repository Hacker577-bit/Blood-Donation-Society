"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/Button";
import { InputField } from "@/app/components/ui/InputField";
import { AreaChip } from "@/app/components/ui/AreaChip";
import {
  registerDonorSchema,
  AREA_VALUES,
  BLOOD_TYPE_VALUES,
  type RegisterDonorInput,
} from "@/lib/validation/registerDonor";
import { AREA_LABELS, BLOOD_TYPE_LABELS } from "@/lib/presentation/labels";
import { registerDonor } from "@/app/actions/registerDonor";

type FieldName = keyof RegisterDonorInput;

interface FormState {
  name: string;
  phone: string;
  bloodType: string;
  areas: string[];
  email: string;
  lastDonationDate: string;
  neverDonated: boolean;
}

const initialState: FormState = {
  name: "",
  phone: "",
  bloodType: "",
  areas: [],
  email: "",
  lastDonationDate: "",
  neverDonated: false,
};

function toValidationInput(form: FormState): unknown {
  return {
    name: form.name,
    phone: form.phone,
    bloodType: form.bloodType || undefined,
    areas: form.areas,
    email: form.email,
    lastDonationDate: form.neverDonated ? null : form.lastDonationDate || undefined,
  };
}

export default function DonorRegistrationPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [touchedFields, setTouchedFields] = useState<Set<FieldName>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validationResult = useMemo(
    () => registerDonorSchema.safeParse(toValidationInput(form)),
    [form],
  );
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

  function toggleArea(area: string) {
    setForm((prev) => ({
      ...prev,
      areas: prev.areas.includes(area)
        ? prev.areas.filter((a) => a !== area)
        : [...prev.areas, area],
    }));
    markTouched("areas");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!isValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerDonor(toValidationInput(form));

      if ("error" in result) {
        setSubmitError(result.error.message);
        if (result.error.fieldErrors) {
          setFieldErrors((prev) => ({ ...prev, ...result.error.fieldErrors }));
        }
        return;
      }

      router.push(`/register/verify?donorId=${result.donorId}`);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8">
      <h1 className="text-heading text-ink-primary">Donor Registration</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
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

        <InputField
          id="email"
          label="Email"
          optional
          type="email"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          onBlur={() => markTouched("email")}
          error={fieldErrors.email}
        />

        <div className="flex flex-col gap-2">
          <label className="text-label text-ink-primary" htmlFor="bloodType">
            Blood type
          </label>
          <select
            id="bloodType"
            value={form.bloodType}
            onChange={(e) => setForm((prev) => ({ ...prev, bloodType: e.target.value }))}
            onBlur={() => markTouched("bloodType")}
            aria-invalid={fieldErrors.bloodType ? "true" : "false"}
            aria-describedby={fieldErrors.bloodType ? "bloodType-error" : undefined}
            className="min-h-[48px] rounded-sm border border-border-hairline bg-surface-raised px-3 text-body text-ink-primary focus:border-accent focus:outline-none"
          >
            <option value="">Select blood type</option>
            {BLOOD_TYPE_VALUES.map((bt) => (
              <option key={bt} value={bt}>
                {BLOOD_TYPE_LABELS[bt]}
              </option>
            ))}
          </select>
          {fieldErrors.bloodType && (
            <p id="bloodType-error" role="alert" className="text-meta text-status-error">
              {fieldErrors.bloodType}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span id="areas-label" className="text-label text-ink-primary">
            Areas
          </span>
          <div role="group" aria-labelledby="areas-label" className="flex flex-wrap gap-2">
            {AREA_VALUES.map((area) => (
              <AreaChip
                key={area}
                label={AREA_LABELS[area]}
                selected={form.areas.includes(area)}
                onToggle={() => {
                  toggleArea(area);
                }}
              />
            ))}
          </div>
          {fieldErrors.areas && (
            <p role="alert" className="text-meta text-status-error">
              {fieldErrors.areas}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-label text-ink-primary" htmlFor="lastDonationDate">
            Last donation date
          </label>
          <input
            id="lastDonationDate"
            type="date"
            disabled={form.neverDonated}
            value={form.lastDonationDate}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, lastDonationDate: e.target.value }))
            }
            onBlur={() => markTouched("lastDonationDate")}
            aria-invalid={fieldErrors.lastDonationDate ? "true" : "false"}
            aria-describedby={
              fieldErrors.lastDonationDate ? "lastDonationDate-error" : undefined
            }
            className="min-h-[48px] rounded-sm border border-border-hairline bg-surface-raised px-3 text-body text-ink-primary focus:border-accent focus:outline-none disabled:text-ink-disabled"
          />
          {fieldErrors.lastDonationDate && (
            <p
              id="lastDonationDate-error"
              role="alert"
              className="text-meta text-status-error"
            >
              {fieldErrors.lastDonationDate}
            </p>
          )}
          <label className="flex items-center gap-2 text-body text-ink-primary">
            <input
              type="checkbox"
              checked={form.neverDonated}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  neverDonated: e.target.checked,
                  lastDonationDate: e.target.checked ? "" : prev.lastDonationDate,
                }))
              }
            />
            Never / not recently
          </label>
        </div>

        {submitError && (
          <p role="alert" className="text-meta text-status-error">
            {submitError}
          </p>
        )}

        <Button disabled={!isValid} loading={isSubmitting}>
          Submit
        </Button>
      </form>
    </main>
  );
}
