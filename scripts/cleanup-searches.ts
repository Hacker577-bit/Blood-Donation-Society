#!/usr/bin/env node

import { prisma } from "../lib/infra/prisma";

const RETENTION_DAYS = Number(process.env.SEARCH_RETENTION_DAYS ?? 90);

async function cleanup() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  console.log(`Deleting Search records older than ${cutoff.toISOString()}...`);

  const count = await prisma.search.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  console.log(`Deleted ${count.count} Search records.`);
  await prisma.$disconnect();
}

cleanup().catch((err) => {
  console.error("Search cleanup failed:", err);
  process.exit(1);
});
