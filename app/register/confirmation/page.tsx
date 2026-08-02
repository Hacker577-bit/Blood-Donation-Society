import { redirect } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { AREA_LABELS } from "@/lib/presentation/labels";
import { findDonorWithAreas } from "@/lib/infra/repositories/donorRepository";
import { computeEligibility } from "@/lib/domain/eligibility";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
});

interface ConfirmationPageProps {
  searchParams: Promise<{ donorId?: string }>;
}

export default async function RegistrationConfirmationPage({
  searchParams,
}: ConfirmationPageProps) {
  const { donorId } = await searchParams;

  if (!donorId) {
    redirect("/register");
  }

  const donor = await findDonorWithAreas(donorId);

  if (!donor) {
    redirect("/register");
  }

  const { isEligible, eligibleAgainOn } = computeEligibility({
    lastDonationDate: donor.lastDonationDate,
  });

  return (
    <main className="tint-gradient flex min-h-[70vh] items-center justify-center px-4 py-10 sm:px-8">
      <div className="card flex w-full max-w-140 flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <span className="flex size-12 items-center justify-center rounded-full bg-status-success-bg text-status-success">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h1 className="text-display text-ink-primary">You&apos;re confirmed</h1>
          <p className="text-body text-ink-secondary">
            You are now discoverable to people who need your blood type.
          </p>
        </div>

        {isEligible ? (
          <StatusBadge status="eligible">Eligible now</StatusBadge>
        ) : (
          <StatusBadge status="cooldown">
            {`Eligible again on ${dateFormatter.format(eligibleAgainOn!)}`}
          </StatusBadge>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-label text-ink-primary">Areas</span>
          <ul className="flex flex-wrap gap-2">
            {donor.areas.map((area) => (
              <li
                key={area}
                className="min-h-[44px] min-w-[44px] flex items-center rounded-full border border-border-hairline bg-surface-raised px-4 text-meta text-ink-primary"
              >
                {AREA_LABELS[area]}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2 rounded-lg bg-accent-soft p-4">
          <span className="text-body font-semibold text-accent">
            What happens next?
          </span>
          <p className="text-meta text-ink-secondary">
            When someone searches for your blood type in your area, they&apos;ll
            be able to contact you directly. Keep your last donation date updated
            from your dashboard.
          </p>
        </div>

        <Link
          href="/manage/dashboard"
          className="inline-flex w-full min-h-[48px] items-center justify-center rounded-lg bg-accent text-accent-on text-body font-semibold shadow-glow transition hover:bg-accent-hover motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          Go to my dashboard
        </Link>
      </div>
    </main>
  );
}
