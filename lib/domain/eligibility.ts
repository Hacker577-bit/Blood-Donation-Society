const ELIGIBILITY_WINDOW_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface EligibilityInput {
  lastDonationDate: Date | null;
}

export interface EligibilityResult {
  isEligible: boolean;
  eligibleAgainOn: Date | null;
}

export function computeEligibility(
  { lastDonationDate }: EligibilityInput,
  now: Date = new Date(),
): EligibilityResult {
  if (lastDonationDate === null) {
    return { isEligible: true, eligibleAgainOn: null };
  }

  const eligibleAgainOn = new Date(
    lastDonationDate.getTime() + ELIGIBILITY_WINDOW_DAYS * MS_PER_DAY,
  );
  const isEligible = now.getTime() >= eligibleAgainOn.getTime();

  return { isEligible, eligibleAgainOn };
}
