#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/infra/prisma";
import type { Area, BloodType } from "../lib/generated/prisma/client";

const BLOOD_TYPES = new Set<BloodType>([
  "A_POS",
  "A_NEG",
  "B_POS",
  "B_NEG",
  "AB_POS",
  "AB_NEG",
  "O_POS",
  "O_NEG",
]);

const AREAS = new Set<Area>([
  "JoharTown",
  "DHA",
  "Gulberg",
  "ModelTown",
  "BahriaTown",
  "Cantt",
  "IqbalTown",
  "GardenTown",
  "WapdaTown",
  "FaisalTown",
]);

interface SeedDonor {
  name: string;
  phone: string;
  bloodType: BloodType;
  areas: Area[];
  lastDonationDate: string | null;
  email: string | null;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error("donors.csv is empty or missing a header row.");
  }

  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    header.forEach((key, i) => {
      row[key] = cells[i] ?? "";
    });
    return row;
  });
}

function toSeedDonor(row: Record<string, string>, lineNo: number): SeedDonor {
  const { name, phone, bloodType, areas, lastDonationDate, email } = row;

  if (!name || !phone || !bloodType || !areas) {
    throw new Error(`Row ${lineNo}: name, phone, bloodType and areas are required.`);
  }

  if (!BLOOD_TYPES.has(bloodType as BloodType)) {
    throw new Error(
      `Row ${lineNo}: unknown bloodType "${bloodType}". ` +
        `Valid values: ${[...BLOOD_TYPES].join(", ")}`,
    );
  }

  const areaList = areas.split(";").filter(Boolean);
  if (areaList.length === 0) {
    throw new Error(`Row ${lineNo}: at least one area is required.`);
  }
  for (const a of areaList) {
    if (!AREAS.has(a as Area)) {
      throw new Error(`Row ${lineNo}: unknown area "${a}". Valid values: ${[...AREAS].join(", ")}`);
    }
  }

  if (lastDonationDate && !/^\d{4}-\d{2}-\d{2}$/.test(lastDonationDate)) {
    throw new Error(`Row ${lineNo}: lastDonationDate must be YYYY-MM-DD or empty.`);
  }

  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    throw new Error(`Row ${lineNo}: phone must be in international format, e.g. +923001234567.`);
  }

  return {
    name,
    phone,
    bloodType: bloodType as BloodType,
    areas: areaList as Area[],
    lastDonationDate: lastDonationDate || null,
    email: email || null,
  };
}

async function seed() {
  const csvPath = path.resolve(process.cwd(), "scripts/donors.csv");
  const rows = parseCsv(readFileSync(csvPath, "utf8"));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const donor = toSeedDonor(rows[i], i + 2);

    const existing = await prisma.donor.findUnique({
      where: { phone: donor.phone },
      select: { id: true },
    });

    const data = {
      name: donor.name,
      bloodType: donor.bloodType,
      lastDonationDate: donor.lastDonationDate ? new Date(donor.lastDonationDate) : null,
      email: donor.email,
      isVerified: true,
    };

    if (existing) {
      await prisma.donor.update({
        where: { id: existing.id },
        data: {
          ...data,
          areas: { deleteMany: {}, create: donor.areas.map((area) => ({ area })) },
        },
      });
      updated++;
    } else {
      await prisma.donor.create({
        data: {
          ...data,
          phone: donor.phone,
          areas: { create: donor.areas.map((area) => ({ area })) },
        },
      });
      created++;
    }
  }

  console.log(
    `Done. ${created} donor(s) created, ${updated} updated, ${skipped} skipped.`,
  );
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error("Seeding failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
