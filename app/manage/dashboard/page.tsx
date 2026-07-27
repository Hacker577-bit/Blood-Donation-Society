import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { AREA_LABELS, BLOOD_TYPE_LABELS } from "@/lib/presentation/labels";
import { findDonorWithAreas } from "@/lib/infra/repositories/donorRepository";
import { computeEligibility } from "@/lib/domain/eligibility";
import { verifySessionToken } from "@/lib/domain/session";
import { joseTokenSigner } from "@/lib/infra/jwt";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
});

export default async function SelfServiceDashboardPage() {
  const token = (await cookies()).get("self_service_session")?.value;

  if (!token) {
    redirect("/manage");
  }

  // joseTokenSigner.verify never throws — expired, tampered, and wrong-key
  // tokens all arrive here as null.
  const session = await verifySessionToken(token, joseTokenSigner);

  if (!session) {
    redirect("/manage");
  }

  // FR-9: identity comes solely from the signed token's subject. Never from a
  // query param, a client-settable cookie value, or a form field.
  const donor = await findDonorWithAreas(session.subject);

  if (!donor || !donor.isVerified) {
    redirect("/manage");
  }

  // Rendering must not spend the budget-of-1, or the donor would arrive with
  // zero actions left and Stories 3.2/3.3 would be unreachable.
  const { isEligible, eligibleAgainOn } = computeEligibility({
    lastDonationDate: donor.lastDonationDate,
  });

  return (
    <main className="mx-auto flex w-full max-w-140 flex-col gap-6 px-4 py-8 sm:px-8">
      <h1 className="text-display text-ink-primary">{donor.name}</h1>

      {isEligible ? (
        <StatusBadge status="eligible">Eligible now</StatusBadge>
      ) : (
        <StatusBadge status="cooldown">
          {`Eligible again on ${dateFormatter.format(eligibleAgainOn!)}`}
        </StatusBadge>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-label text-ink-primary">Blood type</span>
        <span className="text-body text-ink-primary">
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
    </main>
  );
}
