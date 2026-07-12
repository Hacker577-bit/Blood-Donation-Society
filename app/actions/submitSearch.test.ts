import { describe, expect, it, vi, beforeEach } from "vitest";

const findMatchesMock = vi.fn();
const verifySessionTokenMock = vi.fn();
const consumeSessionUseMock = vi.fn();
const createSearchMock = vi.fn();
const notifyMatchesMock = vi.fn();
const afterMock = vi.fn();

let currentTestIp = "198.51.100.1";
let ipCounter = 0;

vi.mock("@/lib/domain/matching", () => ({
  findMatches: (...args: unknown[]) => findMatchesMock(...args),
}));

vi.mock("@/lib/domain/session", () => ({
  verifySessionToken: (...args: unknown[]) => verifySessionTokenMock(...args),
  consumeSessionUse: (...args: unknown[]) => consumeSessionUseMock(...args),
}));

vi.mock("@/lib/domain/notify", () => ({
  notifyMatches: (...args: unknown[]) => notifyMatchesMock(...args),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@vercel/functions", () => ({
  ipAddress: () => currentTestIp,
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
vi.mock("@/lib/infra/jwt", () => ({ joseTokenSigner: {} }));
vi.mock("@/lib/infra/sessionStore", () => ({ redisSessionBudgetStore: {} }));
vi.mock("@/lib/infra/twilio", () => ({ twilioNotificationSender: {} }));
vi.mock("@/lib/infra/sendgrid", () => ({ sendgridEmailNotifier: {} }));

import { submitSearch } from "./submitSearch";

const VALID_INPUT = {
  sessionToken: "signed-jwt",
  searcherName: "Zara Ahmed",
  bloodType: "O_NEG",
  area: "Gulberg",
};

describe("submitSearch server action", () => {
  beforeEach(() => {
    findMatchesMock.mockReset();
    verifySessionTokenMock.mockReset();
    consumeSessionUseMock.mockReset();
    createSearchMock.mockReset();
    notifyMatchesMock.mockReset();
    afterMock.mockReset();
    currentTestIp = `198.51.100.${++ipCounter}`;

    verifySessionTokenMock.mockResolvedValue({
      subject: "+923009999999",
      jti: "jti-1",
    });
    consumeSessionUseMock.mockResolvedValue({ allowed: true, remaining: 1 });
    findMatchesMock.mockResolvedValue([
      { name: "Amara", phone: "+923001111111", area: "Gulberg" },
    ]);
    createSearchMock.mockResolvedValue({ id: "search_1" });
    notifyMatchesMock.mockResolvedValue(undefined);
  });

  it("returns VALIDATION_ERROR with fieldErrors for invalid input", async () => {
    const result = await submitSearch({ ...VALID_INPUT, bloodType: "" });

    expect(result).toMatchObject({
      error: { code: "VALIDATION_ERROR", fieldErrors: { bloodType: expect.any(String) } },
    });
    expect(verifySessionTokenMock).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED once the same IP exceeds the threshold", async () => {
    currentTestIp = "203.0.113.220";

    for (let i = 0; i < 5; i++) {
      await submitSearch(VALID_INPUT);
    }
    verifySessionTokenMock.mockClear();

    const sixth = await submitSearch(VALID_INPUT);

    expect(sixth).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect(verifySessionTokenMock).not.toHaveBeenCalled();
  });

  it("returns SESSION_INVALID when the token fails verification", async () => {
    verifySessionTokenMock.mockResolvedValue(null);

    const result = await submitSearch(VALID_INPUT);

    expect(result).toMatchObject({ error: { code: "SESSION_INVALID" } });
    expect(consumeSessionUseMock).not.toHaveBeenCalled();
  });

  it("returns SESSION_EXHAUSTED when the budget is spent", async () => {
    consumeSessionUseMock.mockResolvedValue({ allowed: false, remaining: 0 });

    const result = await submitSearch(VALID_INPUT);

    expect(result).toMatchObject({ error: { code: "SESSION_EXHAUSTED" } });
    expect(createSearchMock).not.toHaveBeenCalled();
  });

  it("returns matches, records the search with the token's phone (not client input), and consumes the budget exactly once", async () => {
    const result = await submitSearch(VALID_INPUT);

    expect(result).toEqual({
      matches: [{ name: "Amara", phone: "+923001111111", area: "Gulberg" }],
    });
    expect(consumeSessionUseMock).toHaveBeenCalledTimes(1);
    expect(consumeSessionUseMock).toHaveBeenCalledWith("jti-1", expect.anything());
    expect(createSearchMock).toHaveBeenCalledWith({
      searcherName: "Zara Ahmed",
      searcherPhone: "+923009999999",
      bloodType: "O_NEG",
      area: "Gulberg",
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
