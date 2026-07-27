"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/app/components/ui/Button";
import { AreaChip } from "@/app/components/ui/AreaChip";
import { AREA_VALUES, BLOOD_TYPE_VALUES } from "@/lib/validation/registerDonor";
import { AREA_LABELS, BLOOD_TYPE_LABELS } from "@/lib/presentation/labels";
import { getNearbyAreas } from "@/lib/domain/areaAdjacency";
import { submitSearch } from "@/app/actions/submitSearch";
import { expandSearch } from "@/app/actions/expandSearch";

type Step = "form" | "expand" | "results" | "empty";

interface Match {
  name: string;
  phone: string;
  area: string;
  /** Present only for expansion results: every searched area this donor was found in. */
  matchedAreas?: string[];
}

/**
 * Display label for an Area enum value. Falls back to the raw code rather than rendering
 * `undefined` — the cast alone would let an unrecognised value reach user-facing copy silently.
 */
function areaLabel(area: string) {
  return AREA_LABELS[area as keyof typeof AREA_LABELS] ?? area;
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
      <span className="text-meta text-ink-secondary">
        {(match.matchedAreas ?? [match.area]).map(areaLabel).join(", ")}
      </span>
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
  const [areasSearched, setAreasSearched] = useState<string[]>([]);
  const [didExpand, setDidExpand] = useState(false);
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
    setDidExpand(false);
    setAreasSearched([]);
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
      setStep(result.matches.length === 0 ? "expand" : "results");
    } catch {
      setErrorCode("UNEXPECTED");
      setErrorMessage("Something went wrong on our end. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleExpand() {
    setIsSubmitting(true);
    setErrorCode(null);
    setErrorMessage(null);
    try {
      const result = await expandSearch({
        sessionToken,
        searcherName,
        bloodType,
        originArea: area,
      });

      if ("error" in result) {
        setErrorCode(result.error.code);
        setErrorMessage(result.error.message);
        return;
      }

      setMatches(result.matches);
      setAreasSearched(result.areasSearched);
      setDidExpand(true);
      setStep(result.matches.length === 0 ? "empty" : "results");
    } catch {
      setErrorCode("UNEXPECTED");
      setErrorMessage("Something went wrong on our end. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // A spent or invalid session cannot be retried from this screen — re-verification is the only
  // way forward, so the action is disabled rather than left inviting rate-limited dead clicks.
  const isSessionTerminal =
    errorCode === "SESSION_INVALID" || errorCode === "SESSION_EXHAUSTED";

  const errorBlock = errorCode && (
    <p role="alert" className="text-meta text-status-error">
      {errorMessage}
      {isSessionTerminal && (
        <>
          {" "}
          <a href="/search/verify" className="text-accent underline-offset-2 hover:underline">
            Verify your phone again
          </a>
        </>
      )}
    </p>
  );

  const skeletonBlock = isSubmitting && (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <SkeletonRow key={i} index={i} />
      ))}
    </div>
  );

  if (step === "expand") {
    const nearbyLabels = getNearbyAreas(area!).map(
      (a) => AREA_LABELS[a as keyof typeof AREA_LABELS],
    );

    return (
      <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8 motion-reduce:transition-none">
        <h1 className="text-heading text-ink-primary">
          We couldn&apos;t find a match in {AREA_LABELS[area as keyof typeof AREA_LABELS]} yet.
        </h1>
        <p className="text-body text-ink-secondary">
          We can also check nearby areas: {nearbyLabels.join(", ")}.
        </p>

        {skeletonBlock}
        {errorBlock}

        <Button
          type="button"
          onClick={handleExpand}
          disabled={isSessionTerminal}
          loading={isSubmitting}
          loadingText="Searching…"
        >
          Search nearby areas
        </Button>
      </main>
    );
  }

  if (step === "results") {
    // Every area that actually produced a match — drawn from matchedAreas, not the deduped
    // primary area, so an area is never reported as empty because a donor also matched elsewhere.
    const matchedAreaLabels = [
      ...new Set(matches.flatMap((m) => m.matchedAreas ?? [m.area])),
    ].map(areaLabel);

    return (
      <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8 motion-reduce:transition-none">
        <h1 className="text-heading text-ink-primary">Matches</h1>
        {didExpand && (
          <p data-testid="matched-areas-summary" className="text-meta text-ink-secondary">
            Found in {matchedAreaLabels.join(", ")}.
          </p>
        )}
        <div className="flex flex-col gap-4">
          {matches.map((match) => (
            <MatchCard key={match.phone} match={match} />
          ))}
        </div>
      </main>
    );
  }

  if (step === "empty") {
    // "Gulberg" / "Gulberg and Model Town" / "Gulberg, Model Town and Cantt" — one list with a
    // single conjunction. areasSearched is [] when the origin area has no neighbours, which the
    // one-item branch already covers.
    const checkedLabels = [areaLabel(area!), ...areasSearched.map(areaLabel)];
    const checkedPhrase =
      checkedLabels.length > 1
        ? `${checkedLabels.slice(0, -1).join(", ")} and ${checkedLabels[checkedLabels.length - 1]}`
        : checkedLabels[0];

    return (
      <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8 motion-reduce:transition-none">
        <h1 className="text-heading text-ink-primary">No match found yet.</h1>
        <p data-testid="empty-state-body" className="text-body text-ink-secondary">
          We checked {checkedPhrase}, and no eligible donor is listed for{" "}
          {BLOOD_TYPE_LABELS[bloodType as keyof typeof BLOOD_TYPE_LABELS]} right now.
        </p>
        <p className="text-body text-ink-secondary">
          To try a different area, verify your phone again.
        </p>
        <a
          href="/search/verify"
          className="inline-flex w-fit min-h-[44px] items-center text-body text-accent underline underline-offset-2"
        >
          Start a new search
        </a>
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

        {skeletonBlock}
        {errorBlock}

        <Button
          disabled={!isValid || isSessionTerminal}
          loading={isSubmitting}
          loadingText="Searching…"
        >
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
