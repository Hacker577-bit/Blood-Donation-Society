"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/app/components/ui/Button";
import { AreaChip } from "@/app/components/ui/AreaChip";
import { GoogleSignInButton } from "@/app/components/ui/GoogleSignInButton";
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
  const { data: session, status } = useSession();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [step, setStep] = useState<Step>("form");
  const [searcherName, setSearcherName] = useState("");
  const [searcherPhone, setSearcherPhone] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [areasSearched, setAreasSearched] = useState<string[]>([]);
  const [didExpand, setDidExpand] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const correlationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (session?.user?.name) {
      setSearcherName(session.user.name);
    }
  }, [session]);

  useEffect(() => {
    if (headingRef.current) {
      headingRef.current.focus();
    }
  }, [step]);

  if (status === "loading") {
    return (
      <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8">
        <p className="text-body text-ink-secondary">Loading…</p>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-heading text-ink-primary">Search</h1>
          <p className="text-body text-ink-secondary">
            Sign in with Google to search for blood donors.
          </p>
        </div>
        <GoogleSignInButton />
      </main>
    );
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
        searcherName,
        searcherPhone,
        bloodType,
        area,
      });

      if ("error" in result) {
        setErrorCode(result.error.code);
        setErrorMessage(result.error.message);
        return;
      }

      correlationIdRef.current = crypto.randomUUID();
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
        searcherName,
        searcherPhone,
        bloodType,
        originArea: area,
        correlationId: correlationIdRef.current,
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

  const errorBlock = errorCode && (
    <p role="alert" className="text-meta text-status-error">
      {errorMessage}
    </p>
  );

  const announcementMessage =
    step === "results"
      ? `Found ${matches.length} match${matches.length === 1 ? "" : "es"}.`
      : step === "empty"
        ? "No match found in the selected area or nearby areas."
        : step === "expand"
          ? "No match found in the selected area. Nearby areas are available to search."
          : "";

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
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcementMessage}
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="text-heading text-ink-primary">
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
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcementMessage}
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="text-heading text-ink-primary">Matches</h1>
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
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcementMessage}
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="text-heading text-ink-primary">No match found yet.</h1>
        <p data-testid="empty-state-body" className="text-body text-ink-secondary">
          We checked {checkedPhrase}, and no eligible donor is listed for{" "}
          {BLOOD_TYPE_LABELS[bloodType as keyof typeof BLOOD_TYPE_LABELS]} right now.
        </p>
        <p className="text-body text-ink-secondary">
          To try a different area, change the search criteria and search again.
        </p>
        <a
          href="/search"
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
          <label className="text-label text-ink-primary" htmlFor="searcherName">
            Your name
          </label>
          <input
            id="searcherName"
            type="text"
            value={searcherName}
            onChange={(e) => setSearcherName(e.target.value)}
            className="min-h-[48px] rounded-sm border border-border-hairline bg-surface-raised px-3 text-body text-ink-primary focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-label text-ink-primary" htmlFor="searcherPhone">
            Contact number
          </label>
          <input
            id="searcherPhone"
            type="tel"
            placeholder="+923001234567"
            value={searcherPhone}
            onChange={(e) => setSearcherPhone(e.target.value)}
            className="min-h-[48px] rounded-sm border border-border-hairline bg-surface-raised px-3 text-body text-ink-primary focus:border-accent focus:outline-none"
          />
        </div>

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
          disabled={!isValid || searcherPhone.length === 0}
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
  return <SearchForm />;
}
