import { computeEligibility } from "@/lib/domain/eligibility";

export interface DonorMatchCandidate {
  name: string;
  phone: string;
  email: string | null;
  lastDonationDate: Date | null;
}

export interface DonorMatchLookup {
  findVerifiedDonorsByBloodTypeAndArea(criteria: {
    bloodType: string;
    area: string;
  }): Promise<DonorMatchCandidate[]>;
}

export interface DonorMatch {
  name: string;
  phone: string;
  area: string;
  /** Retained for notification dispatch (AC #6); not part of the client-facing match display. */
  email: string | null;
}

export async function findMatches(
  criteria: { bloodType: string; area: string },
  lookup: DonorMatchLookup,
  now: Date = new Date(),
): Promise<DonorMatch[]> {
  const candidates = await lookup.findVerifiedDonorsByBloodTypeAndArea(criteria);

  return candidates
    .filter(
      (candidate) =>
        computeEligibility({ lastDonationDate: candidate.lastDonationDate }, now)
          .isEligible,
    )
    .map((candidate) => ({
      name: candidate.name,
      phone: candidate.phone,
      area: criteria.area,
      email: candidate.email,
    }));
}
