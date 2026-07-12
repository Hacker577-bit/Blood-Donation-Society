import { redirect } from "next/navigation";
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

  if (!donor.isVerified) {
    redirect(`/register/verify?donorId=${donorId}`);
  }

  const { isEligible, eligibleAgainOn } = computeEligibility({
    lastDonationDate: donor.lastDonationDate,
  });

  return (
    <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8">
      <h1 className="text-display text-ink-primary">You&apos;re confirmed</h1>

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
    </main>
  );
}
