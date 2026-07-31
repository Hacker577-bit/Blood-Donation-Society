import type { RateLimitCounterStore } from "@/lib/domain/rate-limit";

const inMemory = new Map<string, string>();

export const memoryRateLimitStore: RateLimitCounterStore = {
  async recordAndCount(key, windowSeconds) {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const member = `${now}-${crypto.randomUUID()}`;
    const existing = inMemory.get(key);
    const entries: Array<{ score: number; member: string }> = existing
      ? JSON.parse(existing)
      : [];

    entries.push({ score: now, member });
    const filtered = entries.filter((e) => e.score >= windowStart);
    inMemory.set(key, JSON.stringify(filtered));
    setTimeout(() => inMemory.delete(key), windowSeconds * 1000);

    const oldest = filtered.length > 0 ? filtered[0].score : null;
    return { count: filtered.length, oldestTimestampMs: oldest };
  },
};

let donorIdCounter = 0;
const donors = new Map<string, {
  id: string;
  googleId: string | null;
  name: string;
  phone: string;
  email: string | null;
  bloodType: string;
  lastDonationDate: string | null;
  isVerified: boolean;
  areas: string[];
}>();

export const memoryDonorRepository = {
  async create(input: {
    googleId?: string;
    name: string;
    phone: string;
    bloodType: string;
    areas: string[];
    email?: string | null;
    lastDonationDate?: Date | null;
    isVerified?: boolean;
  }) {
    donorIdCounter++;
    const id = `mem-donor-${donorIdCounter}`;
    const donor = {
      id,
      googleId: input.googleId ?? null,
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      bloodType: input.bloodType,
      lastDonationDate: input.lastDonationDate?.toISOString() ?? null,
      isVerified: input.isVerified ?? false,
      areas: input.areas,
    };
    donors.set(id, donor);
    return { id };
  },

  async findById(id: string) {
    return donors.get(id) ?? null;
  },

  async findByPhone(phone: string) {
    for (const donor of donors.values()) {
      if (donor.phone === phone) return donor;
    }
    return null;
  },

  async findByGoogleId(googleId: string) {
    for (const donor of donors.values()) {
      if (donor.googleId === googleId) return donor;
    }
    return null;
  },

  async activate(id: string) {
    const donor = donors.get(id);
    if (!donor) return;
    donor.isVerified = true;
  },

  async updateLastDonationDate(id: string, date: Date) {
    const donor = donors.get(id);
    if (!donor) return;
    donor.lastDonationDate = date.toISOString();
  },

  async delete(id: string) {
    donors.delete(id);
  },

  async findEligibleMatches(bloodType: string, area: string) {
    const results: Array<{ name: string; phone: string; email: string | null; area: string }> = [];
    for (const donor of donors.values()) {
      if (!donor.isVerified) continue;
      if (donor.bloodType !== bloodType) continue;
      if (!donor.areas.includes(area)) continue;

      const isEligible = !donor.lastDonationDate ||
        (Date.now() - new Date(donor.lastDonationDate).getTime()) >= 90 * 24 * 60 * 60 * 1000;

      if (!isEligible) continue;

      results.push({ name: donor.name, phone: donor.phone, email: donor.email, area });
    }
    return results;
  },
};

const searches: Array<Record<string, unknown>> = [];

export const memorySearchRepository = {
  async create(input: Record<string, unknown>) {
    const id = `mem-search-${searches.length + 1}`;
    searches.push({ id, ...input });
    return { id };
  },

  async createMany(inputs: Array<Record<string, unknown>>) {
    for (const input of inputs) {
      searches.push({ id: `mem-search-${searches.length + 1}`, ...input });
    }
  },
};
