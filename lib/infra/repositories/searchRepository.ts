import { prisma } from "@/lib/infra/prisma";
import type { Area, BloodType } from "@/lib/generated/prisma/client";

export interface CreateSearchInput {
  searcherName: string;
  searcherPhone: string;
  bloodType: BloodType;
  area: Area;
}

export interface CreatedSearch {
  id: string;
}

export async function createSearch(
  input: CreateSearchInput,
): Promise<CreatedSearch> {
  return prisma.search.create({
    data: input,
    select: { id: true },
  });
}
