import { describe, expect, it, vi, beforeEach } from "vitest";

const donorCreateMock = vi.fn();
const donorFindUniqueMock = vi.fn();
const donorFindManyMock = vi.fn();

vi.mock("@/lib/infra/prisma", () => ({
  prisma: {
    donor: {
      create: (...args: unknown[]) => donorCreateMock(...args),
      findUnique: (...args: unknown[]) => donorFindUniqueMock(...args),
      findMany: (...args: unknown[]) => donorFindManyMock(...args),
    },
  },
}));

import {
  createDonor,
  findDonorWithAreas,
  findVerifiedDonorsByBloodTypeAndArea,
} from "./donorRepository";

describe("donorRepository.createDonor", () => {
  beforeEach(() => {
    donorCreateMock.mockReset();
  });

  it("creates a Donor with nested DonorArea rows in a single write, inactive by default", async () => {
    donorCreateMock.mockResolvedValue({ id: "donor_1" });

    const result = await createDonor({
      name: "Priya Sharma",
      phone: "+923001234567",
      bloodType: "B_POS",
      areas: ["ModelTown", "IqbalTown"],
      email: "priya@example.com",
      lastDonationDate: null,
    });

    expect(result).toEqual({ id: "donor_1" });
    expect(donorCreateMock).toHaveBeenCalledTimes(1);
    const call = donorCreateMock.mock.calls[0][0];
    expect(call.data).toMatchObject({
      name: "Priya Sharma",
      phone: "+923001234567",
      bloodType: "B_POS",
      email: "priya@example.com",
      lastDonationDate: null,
      isVerified: false,
      areas: { create: [{ area: "ModelTown" }, { area: "IqbalTown" }] },
    });
  });

  it("stores every selected area, not just the first", async () => {
    donorCreateMock.mockResolvedValue({ id: "donor_2" });

    await createDonor({
      name: "Rohan Khan",
      phone: "+923011234567",
      bloodType: "O_NEG",
      areas: ["DHA", "Gulberg", "Cantt"],
    });

    const call = donorCreateMock.mock.calls[0][0];
    expect(call.data.areas.create).toHaveLength(3);
  });

  it("stores a null email when none is provided", async () => {
    donorCreateMock.mockResolvedValue({ id: "donor_3" });

    await createDonor({
      name: "No Email Donor",
      phone: "+923021234567",
      bloodType: "A_POS",
      areas: ["FaisalTown"],
    });

    const call = donorCreateMock.mock.calls[0][0];
    expect(call.data.email).toBeNull();
  });

  it("rejects an empty areas array without calling Prisma", async () => {
    await expect(
      createDonor({
        name: "No Area Donor",
        phone: "+923031234567",
        bloodType: "A_POS",
        areas: [],
      }),
    ).rejects.toThrow();

    expect(donorCreateMock).not.toHaveBeenCalled();
  });
});

describe("donorRepository.findDonorWithAreas", () => {
  beforeEach(() => {
    donorFindUniqueMock.mockReset();
  });

  it("returns the donor with a flattened areas array when found", async () => {
    donorFindUniqueMock.mockResolvedValue({
      id: "donor_1",
      name: "Priya Sharma",
      bloodType: "B_POS",
      lastDonationDate: null,
      isVerified: true,
      areas: [{ area: "ModelTown" }, { area: "IqbalTown" }],
    });

    const result = await findDonorWithAreas("donor_1");

    expect(result).toEqual({
      id: "donor_1",
      name: "Priya Sharma",
      bloodType: "B_POS",
      lastDonationDate: null,
      isVerified: true,
      areas: ["ModelTown", "IqbalTown"],
    });
  });

  it("returns null when the donor does not exist", async () => {
    donorFindUniqueMock.mockResolvedValue(null);

    const result = await findDonorWithAreas("missing");

    expect(result).toBeNull();
  });
});

describe("donorRepository.findVerifiedDonorsByBloodTypeAndArea", () => {
  beforeEach(() => {
    donorFindManyMock.mockReset();
  });

  it("queries verified donors matching bloodType and area membership", async () => {
    donorFindManyMock.mockResolvedValue([
      {
        name: "Amara",
        phone: "+923001111111",
        email: "amara@example.com",
        lastDonationDate: null,
      },
    ]);

    const result = await findVerifiedDonorsByBloodTypeAndArea({
      bloodType: "O_NEG",
      area: "Gulberg",
    });

    expect(donorFindManyMock).toHaveBeenCalledWith({
      where: {
        isVerified: true,
        bloodType: "O_NEG",
        areas: { some: { area: "Gulberg" } },
      },
      select: { name: true, phone: true, email: true, lastDonationDate: true },
    });
    expect(result).toEqual([
      {
        name: "Amara",
        phone: "+923001111111",
        email: "amara@example.com",
        lastDonationDate: null,
      },
    ]);
  });

  it("returns an empty array when nothing matches", async () => {
    donorFindManyMock.mockResolvedValue([]);

    const result = await findVerifiedDonorsByBloodTypeAndArea({
      bloodType: "AB_NEG",
      area: "DHA",
    });

    expect(result).toEqual([]);
  });
});
