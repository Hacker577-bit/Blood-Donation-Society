import { describe, expect, it, vi, beforeEach } from "vitest";

const findMatchesMock = vi.fn();
const createSearchMock = vi.fn();
const notifyMatchesMock = vi.fn();
const afterMock = vi.fn();

let currentTestIp = "198.51.100.1";
let ipCounter = 0;
let currentSession = { user: { id: "google-sub-search-1", email: "zara@example.com" } };

vi.mock("@/lib/auth", () => ({
  auth: async () => currentSession,
}));

vi.mock("@/lib/domain/matching", () => ({
  findMatches: (...args: unknown[]) => findMatchesMock(...args),
}));

vi.mock("@/lib/domain/notify", () => ({
  notifyMatches: (...args: unknown[]) => notifyMatchesMock(...args),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@/lib/infra/requestIp", () => ({
  getRequestIp: () => currentTestIp,
}));

vi.mock("next/server", () => ({
  after: (cb: () => Promise<void>) => afterMock(cb),
}));

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

vi.mock("@/lib/infra/repositories/donorRepository", () => ({
  findVerifiedDonorsByBloodTypeAndArea: vi.fn(),
}));
vi.mock("@/lib/infra/repositories/searchRepository", () => ({
  createSearch: (...args: unknown[]) => createSearchMock(...args),
}));
vi.mock("@/lib/infra/twilio", () => ({ twilioNotificationSender: {} }));
vi.mock("@/lib/infra/sendgrid", () => ({ sendgridEmailNotifier: {} }));

import { submitSearch } from "./submitSearch";

const VALID_INPUT = {
  searcherName: "Zara Ahmed",
  searcherPhone: "+923001234567",
  bloodType: "O_NEG",
  area: "Gulberg",
};

describe("submitSearch server action", () => {
  beforeEach(() => {
    findMatchesMock.mockReset();
    createSearchMock.mockReset();
    notifyMatchesMock.mockReset();
    afterMock.mockReset();
    currentTestIp = `198.51.100.${++ipCounter}`;
    currentSession = { user: { id: "google-sub-search-1", email: "zara@example.com" } };

    findMatchesMock.mockResolvedValue([
      { name: "Amara", phone: "+923001111111", area: "Gulberg" },
    ]);
    createSearchMock.mockResolvedValue({ id: "search_1" });
    notifyMatchesMock.mockResolvedValue(undefined);
  });

  it("returns UNAUTHENTICATED without a Google session", async () => {
    currentSession = { user: null } as never;

    const result = await submitSearch(VALID_INPUT);

    expect(result).toMatchObject({
      error: { code: "UNAUTHENTICATED", message: expect.any(String) },
    });
    expect(createSearchMock).not.toHaveBeenCalled();
  });

  it("returns VALIDATION_ERROR with fieldErrors for invalid input", async () => {
    const result = await submitSearch({ ...VALID_INPUT, bloodType: "" });

    expect(result).toMatchObject({
      error: { code: "VALIDATION_ERROR", fieldErrors: { bloodType: expect.any(String) } },
    });
    expect(createSearchMock).not.toHaveBeenCalled();
  });

  it("returns VALIDATION_ERROR when the contact phone is invalid", async () => {
    const result = await submitSearch({ ...VALID_INPUT, searcherPhone: "not-a-phone" });

    expect(result).toMatchObject({
      error: { code: "VALIDATION_ERROR", fieldErrors: { searcherPhone: expect.any(String) } },
    });
    expect(createSearchMock).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED once the same IP exceeds the threshold", async () => {
    currentTestIp = "203.0.113.220";

    for (let i = 0; i < 5; i++) {
      await submitSearch(VALID_INPUT);
    }
    createSearchMock.mockClear();

    const sixth = await submitSearch(VALID_INPUT);

    expect(sixth).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect(createSearchMock).not.toHaveBeenCalled();
  });

  it("returns matches and records the search with the searcher's contact phone", async () => {
    const result = await submitSearch(VALID_INPUT);

    expect(result).toEqual({
      matches: [{ name: "Amara", phone: "+923001111111", area: "Gulberg" }],
    });
    expect(createSearchMock).toHaveBeenCalledWith({
      searcherName: "Zara Ahmed",
      searcherPhone: "+923001234567",
      bloodType: "O_NEG",
      area: "Gulberg",
      correlationId: expect.any(String),
    });
  });

  it("schedules notification dispatch via after() without waiting on it before returning", async () => {
    const result = await submitSearch(VALID_INPUT);

    expect(result).toEqual({
      matches: [{ name: "Amara", phone: "+923001111111", area: "Gulberg" }],
    });
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(notifyMatchesMock).not.toHaveBeenCalled();

    const scheduledCallback = afterMock.mock.calls[0][0];
    await scheduledCallback();
    expect(notifyMatchesMock).toHaveBeenCalledTimes(1);
  });
});
