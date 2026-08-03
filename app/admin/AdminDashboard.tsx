"use client";

import { useMemo, useState } from "react";
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
import {
  adminAddDonor,
  adminDeleteDonor,
  adminLogout,
} from "@/app/actions/admin";

export interface AdminDonorView {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  bloodType: string;
  lastDonationDate: string | null;
  isVerified: boolean;
  areas: string[];
}

type FieldName = keyof RegisterDonorInput;

interface AddFormState {
  name: string;
  phone: string;
  bloodType: string;
  areas: string[];
  email: string;
  lastDonationDate: string;
  neverDonated: boolean;
}

const EMPTY_FORM: AddFormState = {
  name: "",
  phone: "",
  bloodType: "",
  areas: [],
  email: "",
  lastDonationDate: "",
  neverDonated: false,
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function toValidationInput(form: AddFormState): unknown {
  return {
    name: form.name,
    phone: form.phone,
    bloodType: form.bloodType || undefined,
    areas: form.areas,
    email: form.email,
    lastDonationDate: form.neverDonated ? null : form.lastDonationDate || undefined,
  };
}

export function AdminDashboard({ donors }: { donors: AdminDonorView[] }) {
  const router = useRouter();
  const [form, setForm] = useState<AddFormState>(EMPTY_FORM);
  const [touchedFields, setTouchedFields] = useState<Set<FieldName>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const validationResult = useMemo(
    () => registerDonorSchema.safeParse(toValidationInput(form)),
    [form],
  );
  const isValid = validationResult.success;

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

  function resetForm() {
    setForm(EMPTY_FORM);
    setTouchedFields(new Set());
    setFieldErrors({});
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    if (!isValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await adminAddDonor(toValidationInput(form));

      if (!result.ok) {
        setSubmitError(result.error ?? "Something went wrong. Please try again.");
        if (result.fieldErrors) {
          setFieldErrors((prev) => ({ ...prev, ...result.fieldErrors }));
        }
        return;
      }

      setSuccessMessage("Donor added.");
      resetForm();
      router.refresh();
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(donor: AdminDonorView) {
    if (!window.confirm(`Delete ${donor.name}? This cannot be undone.`)) {
      return;
    }

    setDeletingId(donor.id);
    setSubmitError(null);
    try {
      const result = await adminDeleteDonor(donor.id);
      if (!result.ok) {
        setSubmitError(result.error ?? "Delete failed. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleLogout() {
    await adminLogout();
    router.refresh();
  }

  return (
    <main className="tint-gradient px-4 py-10 sm:px-8">
      <div className="mx-auto flex w-full max-w-200 flex-col gap-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-meta font-semibold uppercase tracking-wide text-accent">
              Admin
            </p>
            <h1 className="text-display text-ink-primary">Donor management</h1>
            <p className="text-body text-ink-secondary">
              {donors.length} donor{donors.length === 1 ? "" : "s"} on file.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md px-4 py-2 text-body font-semibold text-ink-secondary transition-colors motion-reduce:transition-none hover:bg-surface-overlay hover:text-ink-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Sign out
          </button>
        </div>

        {submitError && (
          <p role="alert" className="text-meta text-status-error">
            {submitError}
          </p>
        )}

        <section className="card flex flex-col gap-6 p-6 sm:p-8" aria-labelledby="add-donor-heading">
          <div className="flex flex-col gap-2">
            <h2 id="add-donor-heading" className="text-heading text-ink-primary">
              Add a donor
            </h2>
            <p className="text-meta text-ink-secondary">
              Donors added here appear immediately in blood searches.
            </p>
          </div>

          <form onSubmit={handleAdd} className="flex flex-col gap-6" noValidate>
            <div className="grid gap-6 sm:grid-cols-2">
              <InputField
                id="admin-name"
                label="Name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                onBlur={() => markTouched("name")}
                error={fieldErrors.name}
              />

              <InputField
                id="admin-phone"
                label="Phone number"
                placeholder="+923001234567"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                onBlur={() => markTouched("phone")}
                error={fieldErrors.phone}
              />

              <InputField
                id="admin-email"
                label="Email"
                optional
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                onBlur={() => markTouched("email")}
                error={fieldErrors.email}
              />

              <div className="flex flex-col gap-2">
                <label className="text-label text-ink-primary" htmlFor="admin-bloodType">
                  Blood type
                </label>
                <select
                  id="admin-bloodType"
                  value={form.bloodType}
                  onChange={(e) => setForm((prev) => ({ ...prev, bloodType: e.target.value }))}
                  onBlur={() => markTouched("bloodType")}
                  aria-invalid={fieldErrors.bloodType ? "true" : "false"}
                  aria-describedby={
                    fieldErrors.bloodType ? "admin-bloodType-error" : undefined
                  }
                  className="min-h-[48px] rounded-lg border border-border-hairline bg-surface-raised px-3 text-body text-ink-primary shadow-sm focus:border-accent focus:outline-2 focus:outline-offset-1 focus:outline-focus-ring"
                >
                  <option value="">Select blood type</option>
                  {BLOOD_TYPE_VALUES.map((bt) => (
                    <option key={bt} value={bt}>
                      {BLOOD_TYPE_LABELS[bt]}
                    </option>
                  ))}
                </select>
                {fieldErrors.bloodType && (
                  <p id="admin-bloodType-error" role="alert" className="text-meta text-status-error">
                    {fieldErrors.bloodType}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span id="admin-areas-label" className="text-label text-ink-primary">
                Areas
              </span>
              <div
                role="group"
                aria-labelledby="admin-areas-label"
                className="flex flex-wrap gap-2"
              >
                {AREA_VALUES.map((area) => (
                  <AreaChip
                    key={area}
                    label={AREA_LABELS[area]}
                    selected={form.areas.includes(area)}
                    onToggle={() => toggleArea(area)}
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
              <label className="text-label text-ink-primary" htmlFor="admin-lastDonationDate">
                Last donation date
              </label>
              <input
                id="admin-lastDonationDate"
                type="date"
                disabled={form.neverDonated}
                value={form.lastDonationDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, lastDonationDate: e.target.value }))
                }
                onBlur={() => markTouched("lastDonationDate")}
                aria-invalid={fieldErrors.lastDonationDate ? "true" : "false"}
                className="min-h-[48px] rounded-lg border border-border-hairline bg-surface-raised px-3 text-body text-ink-primary shadow-sm focus:border-accent focus:outline-2 focus:outline-offset-1 focus:outline-focus-ring disabled:text-ink-disabled"
              />
              {fieldErrors.lastDonationDate && (
                <p role="alert" className="text-meta text-status-error">
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

            {successMessage && (
              <p role="status" className="text-meta text-status-success">
                {successMessage}
              </p>
            )}

            <div className="sm:w-fit">
              <Button disabled={!isValid} loading={isSubmitting} loadingText="Adding…">
                Add donor
              </Button>
            </div>
          </form>
        </section>

        <section aria-labelledby="donor-list-heading">
          <h2 id="donor-list-heading" className="text-heading mb-4 text-ink-primary">
            All donors
          </h2>

          {donors.length === 0 ? (
            <div className="card flex flex-col gap-2 p-6 text-center sm:p-8">
              <p className="text-body text-ink-primary">No donors yet.</p>
              <p className="text-meta text-ink-secondary">
                Use the form above to add your first donor.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {donors.map((donor) => (
                <li
                  key={donor.id}
                  className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-semibold text-ink-primary">
                        {donor.name}
                      </span>
                      <span className="inline-flex items-center rounded-lg bg-accent-soft px-2 py-0.5 text-meta font-bold text-accent">
                        {BLOOD_TYPE_LABELS[donor.bloodType as keyof typeof BLOOD_TYPE_LABELS]}
                      </span>
                    </div>
                    <p className="text-meta text-ink-secondary">
                      {donor.phone}
                      {donor.email ? ` · ${donor.email}` : ""}
                    </p>
                    <p className="text-meta text-ink-secondary">
                      {donor.areas
                        .map((area) => AREA_LABELS[area as keyof typeof AREA_LABELS])
                        .join(", ")}
                      {donor.lastDonationDate
                        ? ` · Last donated ${dateFormatter.format(new Date(donor.lastDonationDate))}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(donor)}
                    disabled={deletingId === donor.id}
                    className="w-fit rounded-md px-3 py-2 text-meta font-semibold text-status-error transition-colors motion-reduce:transition-none hover:bg-status-error-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:text-ink-disabled"
                  >
                    {deletingId === donor.id ? "Deleting…" : "Delete"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
