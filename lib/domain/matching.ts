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

/** A match from an area-expansion search, carrying every requested area the donor was found in. */
export interface ExpandedDonorMatch extends DonorMatch {
  matchedAreas: string[];
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

/**
 * Area-expansion search (FR-6). Runs the ordinary per-area match once per requested area, so an
 * expanded area can never become a looser-eligibility fallback tier — AD-5's query-time eligibility
 * filter applies identically to every area (PRD FR-4: excluded "at the searched Area or any
 * expanded nearby Area").
 *
 * Deduplicates by phone (the E.164 unique column on Donor) so a donor registered in several
 * expanded areas appears once and is notified once. `matchedAreas` retains *every* requested area
 * that donor was found in — `area` alone would under-report which areas produced results, since it
 * keeps only the first.
 */
export async function findMatchesAcrossAreas(
  criteria: { bloodType: string; areas: string[] },
  lookup: DonorMatchLookup,
  now: Date = new Date(),
): Promise<ExpandedDonorMatch[]> {
  if (criteria.areas.length === 0) {
    return [];
  }

  const perArea = await Promise.all(
    criteria.areas.map((area) => findMatches({ bloodType: criteria.bloodType, area }, lookup, now)),
  );

  const byPhone = new Map<string, ExpandedDonorMatch>();

  for (const matches of perArea) {
    for (const match of matches) {
      const existing = byPhone.get(match.phone);
      if (existing) {
        existing.matchedAreas.push(match.area);
        continue;
      }
      byPhone.set(match.phone, { ...match, matchedAreas: [match.area] });
    }
  }

  return [...byPhone.values()];
}
