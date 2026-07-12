"use server";

import { headers } from "next/headers";
import { ipAddress } from "@vercel/functions";
import { registerDonorSchema } from "@/lib/validation/registerDonor";
import { createDonor } from "@/lib/infra/repositories/donorRepository";
import { checkRateLimit } from "@/lib/domain/rate-limit";
import { redisRateLimitStore } from "@/lib/infra/rateLimitStore";
import type { Area, BloodType } from "@/lib/generated/prisma/client";

const REGISTER_RATE_LIMIT_CONFIG = {
  maxRequests: Number(process.env.RATE_LIMIT_REGISTER_MAX ?? 5),
  windowSeconds: Number(process.env.RATE_LIMIT_REGISTER_WINDOW_SECONDS ?? 60),
};

interface ActionError {
  error: {
    code: string;
    message: string;
    fieldErrors?: Partial<Record<string, string>>;
  };
}

interface ActionSuccess {
  donorId: string;
}

export type RegisterDonorResult = ActionSuccess | ActionError;

const PRISMA_UNIQUE_CONSTRAINT_CODE = "P2002";

interface PrismaUniqueConstraintError {
  code: string;
  meta?: { target?: string[] };
}

function getPhoneUniqueConstraintError(
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

export async function registerDonor(
  input: unknown,
): Promise<RegisterDonorResult> {
  const ip = ipAddress(await headers()) ?? "unknown";
  const rateLimitResult = await checkRateLimit(
    { ip, endpoint: "registerDonor" },
    redisRateLimitStore,
    REGISTER_RATE_LIMIT_CONFIG,
  );

  if (!rateLimitResult.allowed) {
    return {
      error: {
        code: "RATE_LIMITED",
        message: "Too many attempts. Please try again shortly.",
      },
    };
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
      error: {
        code: "VALIDATION_ERROR",
        message: "Please fix the highlighted fields and try again.",
        fieldErrors,
      },
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
    });

    return { donorId: donor.id };
  } catch (err) {
    if (getPhoneUniqueConstraintError(err)) {
      return {
        error: {
          code: "PHONE_ALREADY_REGISTERED",
          message: "That phone number is already registered.",
          fieldErrors: { phone: "That phone number is already registered." },
        },
      };
    }

    console.error("registerDonor: unexpected failure", err);
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    };
  }
}
