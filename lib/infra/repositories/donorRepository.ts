import { prisma } from "@/lib/infra/prisma";
import type { Area, BloodType } from "@/lib/generated/prisma/client";

export interface CreateDonorInput {
  name: string;
  phone: string;
  bloodType: BloodType;
  areas: Area[];
  email?: string;
  lastDonationDate?: Date | null;
}

export interface CreatedDonor {
  id: string;
}

export interface DonorRecord {
  id: string;
  phone: string;
  isVerified: boolean;
}

export interface DonorWithAreas {
  id: string;
  name: string;
  bloodType: BloodType;
  lastDonationDate: Date | null;
  isVerified: boolean;
  areas: Area[];
}

export async function createDonor(
  input: CreateDonorInput,
): Promise<CreatedDonor> {
  if (input.areas.length === 0) {
    throw new Error("createDonor requires at least one area.");
  }

  const donor = await prisma.donor.create({
    data: {
      name: input.name,
      phone: input.phone,
      bloodType: input.bloodType,
      email: input.email && input.email.length > 0 ? input.email : null,
      lastDonationDate: input.lastDonationDate ?? null,
      isVerified: false,
      areas: {
        create: input.areas.map((area) => ({ area })),
      },
    },
    select: { id: true },
  });

  return donor;
}

export async function findDonorById(id: string): Promise<DonorRecord | null> {
  return prisma.donor.findUnique({
    where: { id },
    select: { id: true, phone: true, isVerified: true },
  });
}

export async function activateDonor(id: string): Promise<void> {
  await prisma.donor.update({
    where: { id },
    data: { isVerified: true },
  });
}

export interface DonorMatchCandidateRecord {
  name: string;
  phone: string;
  email: string | null;
  lastDonationDate: Date | null;
}

export async function findVerifiedDonorsByBloodTypeAndArea({
  bloodType,
  area,
}: {
  bloodType: BloodType;
  area: Area;
}): Promise<DonorMatchCandidateRecord[]> {
  return prisma.donor.findMany({
    where: {
      isVerified: true,
      bloodType,
      areas: { some: { area } },
    },
    select: { name: true, phone: true, email: true, lastDonationDate: true },
  });
}

export async function findDonorWithAreas(
  id: string,
): Promise<DonorWithAreas | null> {
  const donor = await prisma.donor.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      bloodType: true,
      lastDonationDate: true,
      isVerified: true,
      areas: { select: { area: true } },
    },
  });

  if (!donor) {
    return null;
  }

  return {
    id: donor.id,
    name: donor.name,
    bloodType: donor.bloodType,
    lastDonationDate: donor.lastDonationDate,
    isVerified: donor.isVerified,
    areas: donor.areas.map((a) => a.area),
  };
}
