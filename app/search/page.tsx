"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/app/components/ui/Button";
import { AreaChip } from "@/app/components/ui/AreaChip";
import { AREA_VALUES, BLOOD_TYPE_VALUES } from "@/lib/validation/registerDonor";
import { AREA_LABELS, BLOOD_TYPE_LABELS } from "@/lib/presentation/labels";
import { submitSearch } from "@/app/actions/submitSearch";

type Step = "form" | "results";

interface Match {
  name: string;
  phone: string;
  area: string;
}

function SkeletonRow({ index }: { index: number }) {
  return (
    <div
      key={index}
      data-testid="skeleton-row"
      className="h-20 animate-pulse rounded-md border border-border-hairline bg-surface-raised motion-reduce:animate-none"
    />
  );
}

function MatchCard({ match }: { match: Match }) {
  const [copied, setCopied] = useState(false);

  function handlePhoneClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (isCoarsePointer) {
      return;
    }
    e.preventDefault();
    navigator.clipboard.writeText(match.phone);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-hairline bg-surface-raised p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <span className="text-body-large text-ink-primary">{match.name}</span>
      <a
        href={`tel:${match.phone}`}
        onClick={handlePhoneClick}
        className="inline-flex w-fit min-h-[44px] items-center rounded-full bg-accent/10 px-3 text-body-large text-accent no-underline"
      >
        {copied ? "Copied" : match.phone}
      </a>
      <span className="text-meta text-ink-secondary">{AREA_LABELS[match.area as keyof typeof AREA_LABELS]}</span>
    </div>
  );
}

function SearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionToken = searchParams.get("sessionToken");
  const searcherName = searchParams.get("name");

  const [step, setStep] = useState<Step>("form");
  const [bloodType, setBloodType] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken || !searcherName) {
      router.replace("/search/verify");
    }
  }, [sessionToken, searcherName, router]);

  if (!sessionToken || !searcherName) {
    return null;
  }

  const isValid = bloodType.length > 0 && area !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) {
      return;
    }

    setIsSubmitting(true);
    setErrorCode(null);
    setErrorMessage(null);
    try {
      const result = await submitSearch({
        sessionToken,
        searcherName,
        bloodType,
        area,
      });

      if ("error" in result) {
        setErrorCode(result.error.code);
        setErrorMessage(result.error.message);
        return;
      }

      setMatches(result.matches);
      setStep("results");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === "results") {
    return (
      <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8 motion-reduce:transition-none">
        <h1 className="text-heading text-ink-primary">Matches</h1>
        {matches.length === 0 ? (
          <p className="text-body text-ink-secondary">
            No matches were found in this area yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {matches.map((match) => (
              <MatchCard key={match.phone} match={match} />
            ))}
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8 motion-reduce:transition-none">
      <h1 className="text-heading text-ink-primary">Search</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <div className="flex flex-col gap-2">
          <label className="text-label text-ink-primary" htmlFor="bloodType">
            Blood type
          </label>
          <select
            id="bloodType"
            value={bloodType}
            onChange={(e) => setBloodType(e.target.value)}
            className="min-h-[48px] rounded-sm border border-border-hairline bg-surface-raised px-3 text-body text-ink-primary focus:border-accent focus:outline-none"
          >
            <option value="">Select blood type</option>
            {BLOOD_TYPE_VALUES.map((bt) => (
              <option key={bt} value={bt}>
                {BLOOD_TYPE_LABELS[bt]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <span id="area-label" className="text-label text-ink-primary">
            Area
          </span>
          <div role="group" aria-labelledby="area-label" className="flex flex-wrap gap-2">
            {AREA_VALUES.map((a) => (
              <AreaChip
                key={a}
                label={AREA_LABELS[a]}
                selected={area === a}
                onToggle={() => setArea(a)}
              />
            ))}
          </div>
        </div>

        {isSubmitting && (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <SkeletonRow key={i} index={i} />
            ))}
          </div>
        )}

        {errorCode && (errorCode === "SESSION_INVALID" || errorCode === "SESSION_EXHAUSTED") && (
          <p role="alert" className="text-meta text-status-error">
            {errorMessage}{" "}
            <a href="/search/verify" className="text-accent underline-offset-2 hover:underline">
              Verify your phone again
            </a>
          </p>
        )}
        {errorCode && errorCode !== "SESSION_INVALID" && errorCode !== "SESSION_EXHAUSTED" && (
          <p role="alert" className="text-meta text-status-error">
            {errorMessage}
          </p>
        )}

        <Button disabled={!isValid} loading={isSubmitting} loadingText="Searching…">
          Search
        </Button>
      </form>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchForm />
    </Suspense>
  );
}
