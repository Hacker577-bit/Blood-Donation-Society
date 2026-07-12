import { describe, expect, it } from "vitest";
import { findMatches, type DonorMatchLookup } from "./matching";

function createFakeLookup(
  donors: Array<{
    name: string;
    phone: string;
    email: string | null;
    lastDonationDate: Date | null;
  }>,
): DonorMatchLookup {
  return {
    async findVerifiedDonorsByBloodTypeAndArea() {
      return donors;
    },
  };
}

const NOW = new Date("2026-07-11T00:00:00.000Z");

describe("findMatches", () => {
  it("returns donors from the lookup as matches with the searched area", async () => {
    const lookup = createFakeLookup([
      { name: "Amara", phone: "+923001111111", email: "amara@example.com", lastDonationDate: null },
    ]);

    const result = await findMatches({ bloodType: "O_NEG", area: "Gulberg" }, lookup, NOW);

    expect(result).toEqual([
      { name: "Amara", phone: "+923001111111", area: "Gulberg", email: "amara@example.com" },
    ]);
  });

  it("excludes a donor whose lastDonationDate is within the 90-day eligibility window", async () => {
    const lookup = createFakeLookup([
      {
        name: "Bilal",
        phone: "+923002222222",
        email: null,
        lastDonationDate: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);

    const result = await findMatches({ bloodType: "O_NEG", area: "Gulberg" }, lookup, NOW);

    expect(result).toEqual([]);
  });

  it("includes a donor with lastDonationDate null (always eligible)", async () => {
    const lookup = createFakeLookup([
      { name: "Amara", phone: "+923001111111", email: null, lastDonationDate: null },
    ]);

    const result = await findMatches({ bloodType: "O_NEG", area: "Gulberg" }, lookup, NOW);

    expect(result).toHaveLength(1);
  });

  it("includes a donor whose 90-day cooldown has fully elapsed", async () => {
    const lookup = createFakeLookup([
      {
        name: "Cyra",
        phone: "+923003333333",
        email: null,
        lastDonationDate: new Date("2026-04-12T00:00:00.000Z"),
      },
    ]);

    const result = await findMatches({ bloodType: "O_NEG", area: "Gulberg" }, lookup, NOW);

    expect(result).toEqual([
      { name: "Cyra", phone: "+923003333333", area: "Gulberg", email: null },
    ]);
  });

  it("returns an empty array when the lookup returns no donors", async () => {
    const lookup = createFakeLookup([]);

    const result = await findMatches({ bloodType: "AB_POS", area: "DHA" }, lookup, NOW);

    expect(result).toEqual([]);
  });
});
