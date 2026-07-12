import { describe, expect, it } from "vitest";
import { computeEligibility } from "./eligibility";

describe("computeEligibility", () => {
  it("is eligible with no eligibleAgainOn when lastDonationDate is null", () => {
    const result = computeEligibility({ lastDonationDate: null });
    expect(result).toEqual({ isEligible: true, eligibleAgainOn: null });
  });

  it("is eligible when exactly 90 days have elapsed", () => {
    const lastDonationDate = new Date("2026-04-09T00:00:00.000Z");
    const now = new Date("2026-07-08T00:00:00.000Z");

    const result = computeEligibility({ lastDonationDate }, now);

    expect(result.isEligible).toBe(true);
    expect(result.eligibleAgainOn).toEqual(new Date("2026-07-08T00:00:00.000Z"));
  });

  it("is not eligible when only 89 days have elapsed", () => {
    const lastDonationDate = new Date("2026-04-10T00:00:00.000Z");
    const now = new Date("2026-07-08T00:00:00.000Z");

    const result = computeEligibility({ lastDonationDate }, now);

    expect(result.isEligible).toBe(false);
    expect(result.eligibleAgainOn).toEqual(new Date("2026-07-09T00:00:00.000Z"));
  });

  it("is not eligible the day after donating", () => {
    const lastDonationDate = new Date("2026-07-07T00:00:00.000Z");
    const now = new Date("2026-07-08T00:00:00.000Z");

    const result = computeEligibility({ lastDonationDate }, now);

    expect(result.isEligible).toBe(false);
    expect(result.eligibleAgainOn).toEqual(new Date("2026-10-05T00:00:00.000Z"));
  });
});
