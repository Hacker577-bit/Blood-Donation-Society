import { describe, expect, it, vi, beforeEach } from "vitest";

const createDonorMock = vi.fn();
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

let currentTestIp = "198.51.100.1";
let ipCounter = 0;

vi.mock("@/lib/infra/repositories/donorRepository", () => ({
  createDonor: (...args: unknown[]) => createDonorMock(...args),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@vercel/functions", () => ({
  ipAddress: () => currentTestIp,
}));

// Real domain rate-limit logic runs against this in-memory fake, so the
// wiring in registerDonor.ts is exercised end-to-end without live Redis.
vi.mock("@/lib/infra/rateLimitStore", () => {
  const hits = new Map<string, number[]>();
  return {
    redisRateLimitStore: {
      async recordAndCount(key: string, windowSeconds: number) {
        const now = Date.now();
        const windowStart = now - windowSeconds * 1000;
        const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);
        timestamps.push(now);
        hits.set(key, timestamps);
        return { count: timestamps.length, oldestTimestampMs: timestamps[0] ?? null };
      },
    },
  };
});

import { registerDonor } from "./registerDonor";

const validInput = {
  name: "Priya Sharma",
  phone: "+923001234567",
  bloodType: "B_POS",
  areas: ["ModelTown", "IqbalTown"],
  email: "",
  lastDonationDate: null,
};

describe("registerDonor server action", () => {
  beforeEach(() => {
    createDonorMock.mockReset();
    consoleErrorSpy.mockClear();
    // Each generic test gets its own IP so the shared in-memory rate-limit
    // store never lets one test's calls count toward another's threshold.
    currentTestIp = `198.51.100.${++ipCounter}`;
  });

  it("creates a Donor on a valid submission and returns its id", async () => {
    createDonorMock.mockResolvedValue({ id: "donor_1" });

    const result = await registerDonor(validInput);

    expect(result).toEqual({ donorId: "donor_1" });
    expect(createDonorMock).toHaveBeenCalledTimes(1);
  });

  it("returns a field-level error and does not call the repository when blood type is missing", async () => {
    const { bloodType, ...rest } = validInput;
    const result = await registerDonor(rest);

    expect(createDonorMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      error: { code: "VALIDATION_ERROR", fieldErrors: { bloodType: expect.any(String) } },
    });
  });

  it("returns a field-level error and does not call the repository when phone is missing", async () => {
    const { phone, ...rest } = validInput;
    const result = await registerDonor(rest);

    expect(createDonorMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      error: { code: "VALIDATION_ERROR", fieldErrors: { phone: expect.any(String) } },
    });
  });

  it("returns a field-level error and does not call the repository when areas is empty", async () => {
    const result = await registerDonor({ ...validInput, areas: [] });

    expect(createDonorMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      error: { code: "VALIDATION_ERROR", fieldErrors: { areas: expect.any(String) } },
    });
  });

  it("returns a field-level error and does not call the repository when areas contains duplicates", async () => {
    const result = await registerDonor({ ...validInput, areas: ["DHA", "DHA"] });

    expect(createDonorMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      error: { code: "VALIDATION_ERROR", fieldErrors: { areas: expect.any(String) } },
    });
  });

  it("returns a field-level error when the last donation date is not a real calendar date", async () => {
    const result = await registerDonor({ ...validInput, lastDonationDate: "2024-13-45" });

    expect(createDonorMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        fieldErrors: { lastDonationDate: expect.any(String) },
      },
    });
  });

  it("succeeds when email is blank", async () => {
    createDonorMock.mockResolvedValue({ id: "donor_2" });

    const result = await registerDonor({ ...validInput, email: "" });

    expect(result).toEqual({ donorId: "donor_2" });
  });

  it("returns a structured field-level error, not a crash, on duplicate phone", async () => {
    createDonorMock.mockRejectedValue({ code: "P2002", meta: { target: ["phone"] } });

    const result = await registerDonor(validInput);

    expect(result).toMatchObject({
      error: { code: "PHONE_ALREADY_REGISTERED", fieldErrors: { phone: expect.any(String) } },
    });
  });

  it("does not mislabel a non-phone unique-constraint violation as a duplicate phone", async () => {
    createDonorMock.mockRejectedValue({ code: "P2002", meta: { target: ["donorId", "area"] } });

    const result = await registerDonor(validInput);

    expect(result).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
    expect(result).not.toMatchObject({ error: { code: "PHONE_ALREADY_REGISTERED" } });
  });

  it("returns a generic structured error, not a crash, for an unexpected failure", async () => {
    createDonorMock.mockRejectedValue(new Error("connection reset"));

    const result = await registerDonor(validInput);

    expect(result).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("returns a structured RATE_LIMITED response and does not call the repository once the same IP exceeds the threshold", async () => {
    currentTestIp = "203.0.113.201";
    createDonorMock.mockResolvedValue({ id: "donor_ok" });

    // Default threshold is 5 requests/window (RATE_LIMIT_REGISTER_MAX) -
    // the 6th submission from the same IP must be rejected.
    for (let i = 0; i < 5; i++) {
      const ok = await registerDonor(validInput);
      expect(ok).not.toMatchObject({ error: { code: "RATE_LIMITED" } });
    }
    createDonorMock.mockClear();

    const sixth = await registerDonor(validInput);

    expect(sixth).toMatchObject({
      error: { code: "RATE_LIMITED", message: expect.any(String) },
    });
    expect(createDonorMock).not.toHaveBeenCalled();
  });

  it("never crashes or returns an unstructured error when rate-limited", async () => {
    currentTestIp = "203.0.113.202";
    createDonorMock.mockResolvedValue({ id: "donor_ok" });

    for (let i = 0; i < 5; i++) {
      await registerDonor(validInput);
    }
    const sixth = await registerDonor(validInput);

    expect(sixth).toHaveProperty("error.code");
    expect(sixth).toHaveProperty("error.message");
  });

  it("does not rate-limit requests from a different IP once another IP's threshold is exhausted", async () => {
    currentTestIp = "203.0.113.203";
    createDonorMock.mockResolvedValue({ id: "donor_exhausted" });
    for (let i = 0; i < 6; i++) {
      await registerDonor(validInput);
    }

    currentTestIp = "203.0.113.204";
    createDonorMock.mockResolvedValue({ id: "donor_fresh_ip" });
    const result = await registerDonor(validInput);

    expect(result).toEqual({ donorId: "donor_fresh_ip" });
  });
});
