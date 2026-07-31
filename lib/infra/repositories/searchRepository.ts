import { prisma } from "@/lib/infra/prisma";
import { memorySearchRepository } from "@/lib/infra/memoryStores";
import type { Area, BloodType } from "@/lib/generated/prisma/client";

const isDevFallback = !process.env.DATABASE_URL;

export interface CreateSearchInput {
  searcherName: string;
  searcherPhone: string;
  bloodType: BloodType;
  area: Area;
  correlationId?: string;
}

export interface CreatedSearch {
  id: string;
}

export async function createSearch(input: CreateSearchInput): Promise<CreatedSearch> {
  if (isDevFallback) {
    return memorySearchRepository.create(input as unknown as Record<string, unknown>) as Promise<CreatedSearch>;
  }

  return prisma.search.create({
    data: {
      searcherName: input.searcherName,
      searcherPhone: input.searcherPhone,
      bloodType: input.bloodType,
      area: input.area,
      correlationId: input.correlationId,
    },
    select: { id: true },
  });
}

export async function createSearches(inputs: CreateSearchInput[]): Promise<void> {
  if (inputs.length === 0) return;

  if (isDevFallback) {
    await memorySearchRepository.createMany(inputs as unknown as Record<string, unknown>[]);
    return;
  }

  await prisma.search.createMany({ data: inputs });
}

export async function deleteSearchesOlderThan(cutoff: Date): Promise<number> {
  if (isDevFallback) return 0;

  const result = await prisma.search.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}
