"use server";

import { after } from "next/server";
import { auth } from "@/lib/auth";
import { getRequestIp } from "@/lib/infra/requestIp";
import { submitSearchSchema } from "@/lib/validation/submitSearch";
import { checkRateLimit } from "@/lib/domain/rate-limit";
import { findMatches, type DonorMatch } from "@/lib/domain/matching";
import { notifyMatches } from "@/lib/domain/notify";
import { redisRateLimitStore } from "@/lib/infra/rateLimitStore";
import * as donorRepository from "@/lib/infra/repositories/donorRepository";
import { createSearch } from "@/lib/infra/repositories/searchRepository";
import { twilioNotificationSender } from "@/lib/infra/twilio";
import { sendgridEmailNotifier } from "@/lib/infra/sendgrid";
import { AREA_LABELS, BLOOD_TYPE_LABELS } from "@/lib/presentation/labels";
import type { Area, BloodType } from "@/lib/generated/prisma/client";

const SUBMIT_SEARCH_RATE_LIMIT_CONFIG = {
  maxRequests: Number(process.env.RATE_LIMIT_SEARCH_MAX ?? 5),
  windowSeconds: Number(process.env.RATE_LIMIT_SEARCH_WINDOW_SECONDS ?? 60),
};

interface ActionError {
  error: {
    code: string;
    message: string;
    fieldErrors?: Partial<Record<string, string>>;
  };
}

interface ActionSuccess {
  matches: Array<Pick<DonorMatch, "name" | "phone" | "area">>;
}

export type SubmitSearchResult = ActionSuccess | ActionError;

export async function submitSearch(input: unknown): Promise<SubmitSearchResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      error: {
        code: "UNAUTHENTICATED",
        message: "Please sign in with Google to search for blood.",
      },
    };
  }

  const ip = await getRequestIp();
  const rateLimitResult = await checkRateLimit(
    { ip, endpoint: "submitSearch" },
    redisRateLimitStore,
    SUBMIT_SEARCH_RATE_LIMIT_CONFIG,
  );

  if (!rateLimitResult.allowed) {
    return {
      error: {
        code: "RATE_LIMITED",
        message: "Too many attempts. Please try again shortly.",
      },
    };
  }

  const inputRecord =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const parsed = submitSearchSchema.safeParse(inputRecord);

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

  const { searcherName, searcherPhone, bloodType, area } = parsed.data;
  const correlationId = crypto.randomUUID();

  const matches = await findMatches({ bloodType, area }, donorRepository);

  await createSearch({
    searcherName,
    searcherPhone,
    bloodType: bloodType as BloodType,
    area: area as Area,
    correlationId,
  });

  after(async () => {
    try {
      await notifyMatches(
        matches.map((m) => ({ name: m.name, phone: m.phone, email: m.email })),
        {
          searcherName,
          searcherPhone,
          bloodType: BLOOD_TYPE_LABELS[bloodType as keyof typeof BLOOD_TYPE_LABELS],
          area: AREA_LABELS[area as keyof typeof AREA_LABELS],
        },
        twilioNotificationSender,
        sendgridEmailNotifier,
      );
    } catch (err) {
      console.error("submitSearch: notification dispatch failed", err);
    }
  });

  return {
    matches: matches.map(({ name, phone, area: matchArea }) => ({
      name,
      phone,
      area: matchArea,
    })),
  };
}
