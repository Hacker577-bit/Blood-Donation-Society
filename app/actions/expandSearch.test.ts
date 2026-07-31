import { describe, expect, it, vi, beforeEach } from "vitest";

const findMatchesAcrossAreasMock = vi.fn();
const getNearbyAreasMock = vi.fn();
const createSearchesMock = vi.fn();
const notifyMatchesMock = vi.fn();
const afterMock = vi.fn();

let currentTestIp = "198.51.100.1";
let ipCounter = 0;
let currentSession = { user: { id: "google-sub-search-1", email: "zara@example.com" } };

vi.mock("@/lib/auth", () => ({
  auth: async () => currentSession,
}));

vi.mock("@/lib/domain/matching", () => ({
  findMatchesAcrossAreas: (...args: unknown[]) => findMatchesAcrossAreasMock(...args),
}));

vi.mock("@/lib/domain/areaAdjacency", () => ({
  getNearbyAreas: (...args: unknown[]) => getNearbyAreasMock(...args),
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
  createSearches: (...args: unknown[]) => createSearchesMock(...args),
}));
vi.mock("@/lib/infra/twilio", () => ({ twilioNotificationSender: {} }));
vi.mock("@/lib/infra/sendgrid", () => ({ sendgridEmailNotifier: {} }));

import { expandSearch } from "./expandSearch";
import { AREA_VALUES } from "@/lib/validation/registerDonor";

// vi.mock intercepts "@/lib/domain/areaAdjacency", so reach past it for the real table.
const { AREA_ADJACENCY, getNearbyAreas: realGetNearbyAreas } =
  await vi.importActual<typeof import("@/lib/domain/areaAdjacency")>(
    "@/lib/domain/areaAdjacency",
  );

const VALID_INPUT = {
  searcherName: "Zara Ahmed",
  searcherPhone: "+923001234567",
  bloodType: "O_NEG",
  originArea: "Gulberg",
};

describe("expandSearch server action", () => {
  beforeEach(() => {
    findMatchesAcrossAreasMock.mockReset();
    getNearbyAreasMock.mockReset();
    createSearchesMock.mockReset();
    notifyMatchesMock.mockReset();
    afterMock.mockReset();
    currentTestIp = `198.51.100.${++ipCounter}`;
    currentSession = { user: { id: "google-sub-search-1", email: "zara@example.com" } };

    getNearbyAreasMock.mockReturnValue(["ModelTown", "Cantt", "GardenTown", "DHA"]);
    findMatchesAcrossAreasMock.mockResolvedValue([
      {
        name: "Amara",
        phone: "+923001111111",
        area: "ModelTown",
        matchedAreas: ["ModelTown", "Cantt"],
        email: "amara@example.com",
      },
    ]);
    createSearchesMock.mockResolvedValue(undefined);
    notifyMatchesMock.mockResolvedValue(undefined);
  });

  it("returns UNAUTHENTICATED without a Google session", async () => {
    currentSession = { user: null } as never;

    const result = await expandSearch(VALID_INPUT);

    expect(result).toMatchObject({
      error: { code: "UNAUTHENTICATED", message: expect.any(String) },
    });
    expect(findMatchesAcrossAreasMock).not.toHaveBeenCalled();
  });

  it("returns VALIDATION_ERROR with fieldErrors for invalid input", async () => {
    const result = await expandSearch({ ...VALID_INPUT, bloodType: "" });

    expect(result).toMatchObject({
      error: { code: "VALIDATION_ERROR", fieldErrors: { bloodType: expect.any(String) } },
    });
    expect(findMatchesAcrossAreasMock).not.toHaveBeenCalled();
  });

  it("returns VALIDATION_ERROR when the contact phone is invalid", async () => {
    const result = await expandSearch({ ...VALID_INPUT, searcherPhone: "nope" });

    expect(result).toMatchObject({
      error: { code: "VALIDATION_ERROR", fieldErrors: { searcherPhone: expect.any(String) } },
    });
    expect(findMatchesAcrossAreasMock).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED once the same IP exceeds the threshold", async () => {
    currentTestIp = "203.0.113.221";

    for (let i = 0; i < 5; i++) {
      await expandSearch(VALID_INPUT);
    }
    findMatchesAcrossAreasMock.mockClear();
    createSearchesMock.mockClear();

    const sixth = await expandSearch(VALID_INPUT);

    expect(sixth).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect(findMatchesAcrossAreasMock).not.toHaveBeenCalled();
  });

  it("returns matches plus the areas searched", async () => {
    const result = await expandSearch(VALID_INPUT);

    expect(result).toEqual({
      matches: [
        {
          name: "Amara",
          phone: "+923001111111",
          area: "ModelTown",
          matchedAreas: ["ModelTown", "Cantt"],
        },
      ],
      areasSearched: ["ModelTown", "Cantt", "GardenTown", "DHA"],
    });
    expect(findMatchesAcrossAreasMock).toHaveBeenCalledWith(
      { bloodType: "O_NEG", areas: ["ModelTown", "Cantt", "GardenTown", "DHA"] },
      expect.anything(),
    );
  });

  it("strips donor email from the client-facing response", async () => {
    const result = await expandSearch(VALID_INPUT);

    expect(result).not.toHaveProperty("matches.0.email");
  });

  it("records one Search row per expanded area in a single batch, always with the searcher's contact phone", async () => {
    await expandSearch(VALID_INPUT);

    expect(createSearchesMock).toHaveBeenCalledTimes(1);
    expect(createSearchesMock).toHaveBeenCalledWith(
      ["ModelTown", "Cantt", "GardenTown", "DHA"].map((area) => ({
        searcherName: "Zara Ahmed",
        searcherPhone: "+923001234567",
        bloodType: "O_NEG",
        area,
        correlationId: undefined,
      })),
    );
  });

  it("short-circuits without repository calls when the origin area has no neighbours", async () => {
    getNearbyAreasMock.mockReturnValue([]);

    const result = await expandSearch(VALID_INPUT);

    expect(result).toEqual({ matches: [], areasSearched: [] });
    expect(findMatchesAcrossAreasMock).not.toHaveBeenCalled();
    expect(createSearchesMock).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("still returns matches and notifies donors when recording the search fails", async () => {
    createSearchesMock.mockRejectedValue(new Error("postgres down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await expandSearch(VALID_INPUT);

    expect(result).toMatchObject({ matches: [{ name: "Amara" }] });
    expect(afterMock).toHaveBeenCalledTimes(1);
    await afterMock.mock.calls[0][0]();
    expect(notifyMatchesMock).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("schedules notification dispatch via after() without waiting on it before returning", async () => {
    const result = await expandSearch(VALID_INPUT);

    expect(result).toMatchObject({ matches: [{ name: "Amara" }] });
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(notifyMatchesMock).not.toHaveBeenCalled();

    const scheduledCallback = afterMock.mock.calls[0][0];
    await scheduledCallback();
    expect(notifyMatchesMock).toHaveBeenCalledTimes(1);
  });

  it("notifies donors about the searcher's ORIGIN area, not the area the donor matched in", async () => {
    await expandSearch(VALID_INPUT);
    await afterMock.mock.calls[0][0]();

    expect(notifyMatchesMock).toHaveBeenCalledWith(
      [{ name: "Amara", phone: "+923001111111", email: "amara@example.com" }],
      {
        searcherName: "Zara Ahmed",
        searcherPhone: "+923001234567",
        bloodType: "O-",
        area: "Gulberg",
      },
      expect.anything(),
      expect.anything(),
    );
  });

  it("swallows notification dispatch failures rather than surfacing them", async () => {
    notifyMatchesMock.mockRejectedValue(new Error("twilio down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expandSearch(VALID_INPUT);

    await expect(afterMock.mock.calls[0][0]()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("expandSearch against the real adjacency table", () => {
  beforeEach(() => {
    findMatchesAcrossAreasMock.mockReset();
    getNearbyAreasMock.mockReset();
    createSearchesMock.mockReset();
    notifyMatchesMock.mockReset();
    afterMock.mockReset();
    currentTestIp = `198.51.100.${++ipCounter}`;

    getNearbyAreasMock.mockImplementation((area: string) => realGetNearbyAreas(area));
    findMatchesAcrossAreasMock.mockResolvedValue([]);
    createSearchesMock.mockResolvedValue(undefined);
    notifyMatchesMock.mockResolvedValue(undefined);
  });

  it("searches exactly the areas AREA_ADJACENCY lists for the origin area", async () => {
    const result = await expandSearch({ ...VALID_INPUT, originArea: "Gulberg" });

    expect(result).toMatchObject({ areasSearched: [...AREA_ADJACENCY.Gulberg] });
    expect(findMatchesAcrossAreasMock).toHaveBeenCalledWith(
      { bloodType: "O_NEG", areas: [...AREA_ADJACENCY.Gulberg] },
      expect.anything(),
    );
  });

  it("never re-searches the origin area itself, for every area in the enum", async () => {
    for (const originArea of AREA_VALUES) {
      findMatchesAcrossAreasMock.mockClear();
      currentTestIp = `198.51.100.${++ipCounter}`;

      const result = await expandSearch({ ...VALID_INPUT, originArea });

      expect(result).not.toHaveProperty("error");
      const { areas } = findMatchesAcrossAreasMock.mock.calls[0][0];
      expect(areas).not.toContain(originArea);
      expect(areas.length).toBeGreaterThan(0);
    }
  });
});
