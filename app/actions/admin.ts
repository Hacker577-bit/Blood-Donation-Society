"use server";

import {
  isAdminAuthenticated,
  verifyAdminPassword,
  createAdminSession,
  destroyAdminSession,
} from "@/lib/admin-auth";
import { registerDonorSchema } from "@/lib/validation/registerDonor";
import {
  createDonor,
  deleteDonor,
  listAllDonors,
} from "@/lib/infra/repositories/donorRepository";
import type { Area, BloodType } from "@/lib/generated/prisma/client";

const PRISMA_UNIQUE_CONSTRAINT_CODE = "P2002";

interface PrismaUniqueConstraintError {
  code: string;
  meta?: { target?: string[] };
}

function isPhoneUniqueConstraintError(
  err: unknown,
): PrismaUniqueConstraintError | null {
  if (
    typeof err !== "object" ||
    err === null ||
    !("code" in err) ||
    (err as { code?: unknown }).code !== PRISMA_UNIQUE_CONSTRAINT_CODE
  ) {
    return null;
  }

  const prismaErr = err as PrismaUniqueConstraintError;
  return prismaErr.meta?.target?.includes("phone") ? prismaErr : null;
}

export interface AdminLoginResult {
  ok: boolean;
  error?: string;
}

export async function adminLogin(password: string): Promise<AdminLoginResult> {
  if (!verifyAdminPassword(password)) {
    return { ok: false, error: "Incorrect password." };
  }

  await createAdminSession();
  return { ok: true };
}

export async function adminLogout(): Promise<void> {
  await destroyAdminSession();
}

export interface AdminAddDonorResult {
  ok: boolean;
  donorId?: string;
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
}

export async function adminAddDonor(input: unknown): Promise<AdminAddDonorResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, error: "Admin session expired. Sign in again." };
  }

  const parsed = registerDonorSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !(field in fieldErrors)) {
        fieldErrors[field] = issue.message;
      }
    }

    return {
      ok: false,
      error: "Please fix the highlighted fields and try again.",
      fieldErrors,
    };
  }

  const data = parsed.data;

  try {
    const donor = await createDonor({
      name: data.name,
      phone: data.phone,
      bloodType: data.bloodType as BloodType,
      areas: data.areas as Area[],
      email: data.email,
      lastDonationDate: data.lastDonationDate
        ? new Date(data.lastDonationDate)
        : null,
      isVerified: true,
    });

    return { ok: true, donorId: donor.id };
  } catch (err) {
    if (isPhoneUniqueConstraintError(err)) {
      return {
        ok: false,
        error: "That phone number is already registered.",
        fieldErrors: { phone: "That phone number is already registered." },
      };
    }

    console.error("adminAddDonor: unexpected failure", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export interface AdminDeleteDonorResult {
  ok: boolean;
  error?: string;
}

export async function adminDeleteDonor(donorId: string): Promise<AdminDeleteDonorResult> {
  if (!(await isAdminAuthenticated())) {
    return { ok: false, error: "Admin session expired. Sign in again." };
  }

  try {
    await deleteDonor(donorId);
    return { ok: true };
  } catch (err) {
    console.error("adminDeleteDonor: unexpected failure", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export type { AdminDonorRecord } from "@/lib/infra/repositories/donorRepository";
export { listAllDonors };
