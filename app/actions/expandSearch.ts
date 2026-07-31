"use server";

import { after } from "next/server";
import { auth } from "@/lib/auth";
import { getRequestIp } from "@/lib/infra/requestIp";
import { expandSearchSchema } from "@/lib/validation/expandSearch";
import { checkRateLimit } from "@/lib/domain/rate-limit";
import { findMatchesAcrossAreas, type ExpandedDonorMatch } from "@/lib/domain/matching";
import { getNearbyAreas } from "@/lib/domain/areaAdjacency";
import { notifyMatches } from "@/lib/domain/notify";
import { redisRateLimitStore } from "@/lib/infra/rateLimitStore";
import * as donorRepository from "@/lib/infra/repositories/donorRepository";
import { createSearches } from "@/lib/infra/repositories/searchRepository";
import { twilioNotificationSender } from "@/lib/infra/twilio";
import { sendgridEmailNotifier } from "@/lib/infra/sendgrid";
import { AREA_LABELS, BLOOD_TYPE_LABELS } from "@/lib/presentation/labels";
import type { Area, BloodType } from "@/lib/generated/prisma/client";

// Reuses submitSearch's tunables: expansion is the same cost category (it triggers the same real
// SMS/email sends). The distinct endpoint key still gives it its own AD-3 bucket.
const EXPAND_SEARCH_RATE_LIMIT_CONFIG = {
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
  matches: Array<Pick<ExpandedDonorMatch, "name" | "phone" | "area" | "matchedAreas">>;
  areasSearched: string[];
}

export type ExpandSearchResult = ActionSuccess | ActionError;

export async function expandSearch(input: unknown): Promise<ExpandSearchResult> {
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
    { ip, endpoint: "expandSearch" },
    redisRateLimitStore,
    EXPAND_SEARCH_RATE_LIMIT_CONFIG,
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
  const parsed = expandSearchSchema.safeParse(inputRecord);

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

  const { searcherName, searcherPhone, bloodType, originArea } = parsed.data;
  const nearbyAreas = getNearbyAreas(originArea);

  if (nearbyAreas.length === 0) {
    return { matches: [], areasSearched: [] };
  }

  const matches = await findMatchesAcrossAreas(
    { bloodType, areas: nearbyAreas },
    donorRepository,
  );

  try {
    await createSearches(
      nearbyAreas.map((area) => ({
        searcherName,
        searcherPhone,
        bloodType: bloodType as BloodType,
        area: area as Area,
        correlationId: parsed.data.correlationId,
      })),
    );
  } catch (err) {
    console.error("expandSearch: failed to record expanded search", err);
  }

  after(async () => {
    try {
      await notifyMatches(
        matches.map((m) => ({ name: m.name, phone: m.phone, email: m.email })),
        {
          searcherName,
          searcherPhone,
          bloodType: BLOOD_TYPE_LABELS[bloodType as keyof typeof BLOOD_TYPE_LABELS],
          // The searcher's origin area — where blood is needed — not where the donor is registered.
          area: AREA_LABELS[originArea as keyof typeof AREA_LABELS],
        },
        twilioNotificationSender,
        sendgridEmailNotifier,
      );
    } catch (err) {
      console.error("expandSearch: notification dispatch failed", err);
    }
  });

  return {
    matches: matches.map(({ name, phone, area, matchedAreas }) => ({
      name,
      phone,
      area,
      matchedAreas,
    })),
    areasSearched: nearbyAreas,
  };
}
