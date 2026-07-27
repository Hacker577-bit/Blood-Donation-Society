import { describe, expect, it, vi } from "vitest";
import { findMatches, findMatchesAcrossAreas, type DonorMatchLookup } from "./matching";

type FakeDonor = {
  name: string;
  phone: string;
  email: string | null;
  lastDonationDate: Date | null;
};

function createFakeLookup(donors: FakeDonor[]): DonorMatchLookup {
  return {
    async findVerifiedDonorsByBloodTypeAndArea() {
      return donors;
    },
  };
}

/** Lookup that returns a different donor set per area, so cross-area behaviour is observable. */
function createFakeLookupByArea(
  donorsByArea: Record<string, FakeDonor[]>,
): DonorMatchLookup {
  return {
    async findVerifiedDonorsByBloodTypeAndArea({ area }) {
      return donorsByArea[area] ?? [];
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

describe("findMatchesAcrossAreas", () => {
  it("aggregates matches from every requested area, tagged with the area each was found in", async () => {
    const lookup = createFakeLookupByArea({
      Cantt: [
        { name: "Amara", phone: "+923001111111", email: "amara@example.com", lastDonationDate: null },
      ],
      Gulberg: [
        { name: "Cyra", phone: "+923003333333", email: null, lastDonationDate: null },
      ],
    });

    const result = await findMatchesAcrossAreas(
      { bloodType: "O_NEG", areas: ["Cantt", "Gulberg"] },
      lookup,
      NOW,
    );

    expect(result).toEqual([
      {
        name: "Amara",
        phone: "+923001111111",
        area: "Cantt",
        email: "amara@example.com",
        matchedAreas: ["Cantt"],
      },
      {
        name: "Cyra",
        phone: "+923003333333",
        area: "Gulberg",
        email: null,
        matchedAreas: ["Gulberg"],
      },
    ]);
  });

  it("excludes an ineligible donor even when blood type and an expanded area match (FR-4)", async () => {
    const lookup = createFakeLookupByArea({
      Cantt: [
        {
          name: "Bilal",
          phone: "+923002222222",
          email: null,
          lastDonationDate: new Date("2026-07-01T00:00:00.000Z"),
        },
      ],
      Gulberg: [
        { name: "Cyra", phone: "+923003333333", email: null, lastDonationDate: null },
      ],
    });

    const result = await findMatchesAcrossAreas(
      { bloodType: "O_NEG", areas: ["Cantt", "Gulberg"] },
      lookup,
      NOW,
    );

    expect(result.map((m) => m.phone)).toEqual(["+923003333333"]);
  });

  it("returns a donor registered in several requested areas exactly once, tagged with the first area searched", async () => {
    const shared = {
      name: "Amara",
      phone: "+923001111111",
      email: "amara@example.com",
      lastDonationDate: null,
    };
    const lookup = createFakeLookupByArea({
      Cantt: [shared],
      Gulberg: [shared],
      DHA: [shared],
    });

    const result = await findMatchesAcrossAreas(
      { bloodType: "O_NEG", areas: ["Cantt", "Gulberg", "DHA"] },
      lookup,
      NOW,
    );

    expect(result).toEqual([
      {
        name: "Amara",
        phone: "+923001111111",
        area: "Cantt",
        email: "amara@example.com",
        matchedAreas: ["Cantt", "Gulberg", "DHA"],
      },
    ]);
  });

  it("records every area a deduped donor matched in, so no producing area is reported as empty", async () => {
    const spanning = {
      name: "Amara",
      phone: "+923001111111",
      email: null,
      lastDonationDate: null,
    };
    const canttOnly = {
      name: "Cyra",
      phone: "+923003333333",
      email: null,
      lastDonationDate: null,
    };
    const lookup = createFakeLookupByArea({
      ModelTown: [spanning],
      Cantt: [spanning, canttOnly],
      GardenTown: [],
    });

    const result = await findMatchesAcrossAreas(
      { bloodType: "O_NEG", areas: ["ModelTown", "Cantt", "GardenTown"] },
      lookup,
      NOW,
    );

    const producingAreas = new Set(result.flatMap((m) => m.matchedAreas));
    expect(producingAreas).toEqual(new Set(["ModelTown", "Cantt"]));
    expect(result.find((m) => m.phone === spanning.phone)?.matchedAreas).toEqual([
      "ModelTown",
      "Cantt",
    ]);
    expect(result.find((m) => m.phone === canttOnly.phone)?.matchedAreas).toEqual(["Cantt"]);
  });

  it("returns an empty array without touching the lookup when no areas are requested", async () => {
    const findVerifiedDonorsByBloodTypeAndArea = vi.fn();
    const lookup: DonorMatchLookup = { findVerifiedDonorsByBloodTypeAndArea };

    const result = await findMatchesAcrossAreas(
      { bloodType: "O_NEG", areas: [] },
      lookup,
      NOW,
    );

    expect(result).toEqual([]);
    expect(findVerifiedDonorsByBloodTypeAndArea).not.toHaveBeenCalled();
  });

  it("returns an empty array when no requested area holds an eligible donor", async () => {
    const lookup = createFakeLookupByArea({});

    const result = await findMatchesAcrossAreas(
      { bloodType: "O_NEG", areas: ["Cantt", "Gulberg"] },
      lookup,
      NOW,
    );

    expect(result).toEqual([]);
  });
});

