"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { ipAddress } from "@vercel/functions";
import { submitSearchSchema } from "@/lib/validation/submitSearch";
import { checkRateLimit } from "@/lib/domain/rate-limit";
import { verifySessionToken, consumeSessionUse } from "@/lib/domain/session";
import { findMatches, type DonorMatch } from "@/lib/domain/matching";
import { notifyMatches } from "@/lib/domain/notify";
import { redisRateLimitStore } from "@/lib/infra/rateLimitStore";
import { joseTokenSigner } from "@/lib/infra/jwt";
import { redisSessionBudgetStore } from "@/lib/infra/sessionStore";
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
  const ip = ipAddress(await headers()) ?? "unknown";
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

  const sessionToken =
    typeof inputRecord.sessionToken === "string" ? inputRecord.sessionToken : "";
  const verifiedToken = await verifySessionToken(sessionToken, joseTokenSigner);

  if (!verifiedToken) {
    return {
      error: {
        code: "SESSION_INVALID",
        message: "Your session has expired. Please verify your phone again.",
      },
    };
  }

  const budgetResult = await consumeSessionUse(verifiedToken.jti, redisSessionBudgetStore);

  if (!budgetResult.allowed) {
    return {
      error: {
        code: "SESSION_EXHAUSTED",
        message: "This search session has been used up. Please verify your phone again.",
      },
    };
  }

  const { searcherName, bloodType, area } = parsed.data;
  const searcherPhone = verifiedToken.subject;

  const matches = await findMatches({ bloodType, area }, donorRepository);

  await createSearch({
    searcherName,
    searcherPhone,
    bloodType: bloodType as BloodType,
    area: area as Area,
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
