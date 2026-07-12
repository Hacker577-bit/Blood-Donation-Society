import { describe, expect, it, vi, beforeEach } from "vitest";

const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  decr: vi.fn(),
}));

vi.mock("@/lib/infra/redis", () => ({ redis: redisMock }));

import { redisSessionBudgetStore } from "./sessionStore";

describe("redisSessionBudgetStore", () => {
  beforeEach(() => {
    redisMock.get.mockReset();
    redisMock.set.mockReset();
    redisMock.decr.mockReset();
  });

  it("initialize sets the budget with the given TTL", async () => {
    await redisSessionBudgetStore.initialize("jti-1", 2, 900);

    expect(redisMock.set).toHaveBeenCalledWith("jti-1", 2, { ex: 900 });
  });

  it("consume on a nonexistent key returns null without calling decr", async () => {
    redisMock.get.mockResolvedValue(null);

    const result = await redisSessionBudgetStore.consume("unknown-jti");

    expect(result).toBeNull();
    expect(redisMock.decr).not.toHaveBeenCalled();
  });

  it("consume on an existing key with remaining budget decrements and allows", async () => {
    redisMock.get.mockResolvedValue(2);
    redisMock.decr.mockResolvedValue(1);

    const result = await redisSessionBudgetStore.consume("jti-1");

    expect(redisMock.decr).toHaveBeenCalledWith("jti-1");
    expect(result).toEqual({ allowed: true, remaining: 1 });
  });

  it("consume when budget is already at 0 disallows", async () => {
    redisMock.get.mockResolvedValue(0);
    redisMock.decr.mockResolvedValue(-1);

    const result = await redisSessionBudgetStore.consume("jti-1");

    expect(result).toEqual({ allowed: false, remaining: 0 });
  });
});
