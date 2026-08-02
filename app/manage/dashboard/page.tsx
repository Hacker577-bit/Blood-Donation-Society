import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { AREA_LABELS, BLOOD_TYPE_LABELS } from "@/lib/presentation/labels";
import { findDonorWithAreasByGoogleId } from "@/lib/infra/repositories/donorRepository";
import { computeEligibility } from "@/lib/domain/eligibility";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
});

export default async function SelfServiceDashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/manage");
  }

  const donor = await findDonorWithAreasByGoogleId(session.user.id);

  if (!donor || !donor.isVerified) {
    redirect("/manage");
  }

  const { isEligible, eligibleAgainOn } = computeEligibility({
    lastDonationDate: donor.lastDonationDate,
  });

  return (
    <main className="tint-gradient px-4 py-10 sm:px-8">
      <div className="mx-auto flex w-full max-w-140 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-meta font-semibold uppercase tracking-wide text-accent">
            Donor dashboard
          </p>
          <h1 className="text-display text-ink-primary">{donor.name}</h1>
        </div>

        <div className="card flex flex-col gap-6 p-6 sm:p-8">
          {isEligible ? (
            <StatusBadge status="eligible">Eligible now</StatusBadge>
          ) : (
            <StatusBadge status="cooldown">
              {`Eligible again on ${dateFormatter.format(eligibleAgainOn!)}`}
            </StatusBadge>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-label text-ink-primary">Blood type</span>
            <span className="inline-flex w-fit items-center rounded-lg bg-accent-soft px-3 py-1 text-body-large font-bold text-accent">
              {BLOOD_TYPE_LABELS[donor.bloodType]}
            </span>
          </div>

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
              How to stay reachable
            </span>
            <p className="text-meta text-ink-secondary">
              Keep your phone number and last donation date accurate so searchers
              reach only currently-eligible donors like you.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
