import { prisma } from "@/lib/infra/prisma";
import { memoryDonorRepository } from "@/lib/infra/memoryStores";
import type { Area, BloodType } from "@/lib/generated/prisma/client";

const isDevFallback = !process.env.DATABASE_URL;

export interface CreateDonorInput {
  googleId?: string;
  name: string;
  phone: string;
  bloodType: BloodType;
  areas: Area[];
  email?: string;
  lastDonationDate?: Date | null;
  isVerified?: boolean;
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

export interface DonorMatchCandidateRecord {
  name: string;
  phone: string;
  email: string | null;
  lastDonationDate: Date | null;
}

export async function createDonor(input: CreateDonorInput): Promise<CreatedDonor> {
  if (input.areas.length === 0) {
    throw new Error("createDonor requires at least one area.");
  }

  if (isDevFallback) {
    return memoryDonorRepository.create({
      googleId: input.googleId,
      name: input.name,
      phone: input.phone,
      bloodType: input.bloodType,
      areas: input.areas,
      email: input.email,
      lastDonationDate: input.lastDonationDate,
      isVerified: input.isVerified ?? false,
    });
  }

  const donor = await prisma.donor.create({
    data: {
      googleId: input.googleId ?? null,
      name: input.name,
      phone: input.phone,
      bloodType: input.bloodType,
      email: input.email && input.email.length > 0 ? input.email : null,
      lastDonationDate: input.lastDonationDate ?? null,
      isVerified: input.isVerified ?? false,
      areas: {
        create: input.areas.map((area) => ({ area })),
      },
    },
    select: { id: true },
  });

  return donor;
}

export async function findDonorByGoogleId(
  googleId: string,
): Promise<DonorRecord | null> {
  if (isDevFallback) {
    const d = await memoryDonorRepository.findByGoogleId(googleId);
    if (!d) return null;
    return { id: d.id, phone: d.phone, isVerified: d.isVerified };
  }

  return prisma.donor.findUnique({
    where: { googleId },
    select: { id: true, phone: true, isVerified: true },
  });
}

export async function findDonorById(id: string): Promise<DonorRecord | null> {
  if (isDevFallback) {
    const d = await memoryDonorRepository.findById(id);
    if (!d) return null;
    return { id: d.id, phone: d.phone, isVerified: d.isVerified };
  }

  return prisma.donor.findUnique({
    where: { id },
    select: { id: true, phone: true, isVerified: true },
  });
}

export async function findDonorByPhone(phone: string): Promise<DonorRecord | null> {
  if (isDevFallback) {
    const d = await memoryDonorRepository.findByPhone(phone);
    if (!d) return null;
    return { id: d.id, phone: d.phone, isVerified: d.isVerified };
  }

  return prisma.donor.findUnique({
    where: { phone },
    select: { id: true, phone: true, isVerified: true },
  });
}

export async function activateDonor(id: string): Promise<void> {
  if (isDevFallback) {
    memoryDonorRepository.activate(id);
    return;
  }

  await prisma.donor.update({
    where: { id },
    data: { isVerified: true },
  });
}

export async function findVerifiedDonorsByBloodTypeAndArea({
  bloodType,
  area,
}: {
  bloodType: BloodType;
  area: Area;
}): Promise<DonorMatchCandidateRecord[]> {
  if (isDevFallback) {
    const matches = await memoryDonorRepository.findEligibleMatches(bloodType, area);
    return matches.map((m) => ({
      name: m.name,
      phone: m.phone,
      email: m.email,
      lastDonationDate: null,
    }));
  }

  return prisma.donor.findMany({
    where: {
      isVerified: true,
      bloodType,
      areas: { some: { area } },
    },
    select: { name: true, phone: true, email: true, lastDonationDate: true },
  });
}

export async function findDonorWithAreas(id: string): Promise<DonorWithAreas | null> {
  if (isDevFallback) {
    const d = await memoryDonorRepository.findById(id);
    if (!d) return null;
    return {
      id: d.id,
      name: d.name,
      bloodType: d.bloodType as BloodType,
      lastDonationDate: d.lastDonationDate ? new Date(d.lastDonationDate) : null,
      isVerified: d.isVerified,
      areas: d.areas as Area[],
    };
  }

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

export async function findDonorWithAreasByGoogleId(
  googleId: string,
): Promise<DonorWithAreas | null> {
  if (isDevFallback) {
    const d = await memoryDonorRepository.findByGoogleId(googleId);
    if (!d) return null;
    return {
      id: d.id,
      name: d.name,
      bloodType: d.bloodType as BloodType,
      lastDonationDate: d.lastDonationDate ? new Date(d.lastDonationDate) : null,
      isVerified: d.isVerified,
      areas: d.areas as Area[],
    };
  }

  const donor = await prisma.donor.findUnique({
    where: { googleId },
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

export async function updateLastDonationDate(id: string, date: Date): Promise<void> {
  if (isDevFallback) {
    memoryDonorRepository.updateLastDonationDate(id, date);
    return;
  }

  await prisma.donor.update({
    where: { id },
    data: { lastDonationDate: date },
  });
}

export async function deleteDonor(id: string): Promise<void> {
  if (isDevFallback) {
    memoryDonorRepository.delete(id);
    return;
  }

  await prisma.donor.delete({ where: { id } });
}
