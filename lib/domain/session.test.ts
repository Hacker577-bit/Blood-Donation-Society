import { describe, expect, it } from "vitest";
import {
  issueSessionToken,
  consumeSessionUse,
  verifySessionToken,
  type SessionBudgetStore,
  type TokenSigner,
} from "./session";

function createFakeSigner(): TokenSigner & { signedTokens: Map<string, { sub: string; jti: string }> } {
  const signedTokens = new Map<string, { sub: string; jti: string }>();
  let counter = 0;
  return {
    signedTokens,
    async sign(payload) {
      const token = `fake-token-${counter++}`;
      signedTokens.set(token, payload);
      return token;
    },
    async verify(token) {
      return signedTokens.get(token) ?? null;
    },
  };
}

function createFakeStore(): SessionBudgetStore & { data: Map<string, number> } {
  const data = new Map<string, number>();
  return {
    data,
    async initialize(jti, budget) {
      data.set(jti, budget);
    },
    async consume(jti) {
      if (!data.has(jti)) {
        return null;
      }
      const remaining = (data.get(jti) as number) - 1;
      data.set(jti, remaining);
      return { allowed: remaining >= 0, remaining: Math.max(remaining, 0) };
    },
  };
}

const SUBJECT = "+923001234567";

describe("session domain service", () => {
  it("issues a signed token and initializes the budget with a 900s TTL", async () => {
    const signer = createFakeSigner();
    const store = createFakeStore();

    const { token, jti } = await issueSessionToken({ subject: SUBJECT, budget: 2 }, signer, store);

    expect(signer.signedTokens.get(token)).toEqual({ sub: SUBJECT, jti });
    expect(store.data.get(jti)).toBe(2);
  });

  it("allows consumption while budget remains, then disallows once exhausted", async () => {
    const signer = createFakeSigner();
    const store = createFakeStore();
    const { jti } = await issueSessionToken({ subject: SUBJECT, budget: 2 }, signer, store);

    const first = await consumeSessionUse(jti, store);
    const second = await consumeSessionUse(jti, store);
    const third = await consumeSessionUse(jti, store);

    expect(first).toEqual({ allowed: true, remaining: 1 });
    expect(second).toEqual({ allowed: true, remaining: 0 });
    expect(third).toEqual({ allowed: false, remaining: 0 });
  });

  it("returns not-allowed for an unknown jti", async () => {
    const store = createFakeStore();

    const result = await consumeSessionUse("unknown-jti", store);

    expect(result).toEqual({ allowed: false, remaining: 0 });
  });

  it("verifySessionToken maps a valid token to subject/jti", async () => {
    const signer = createFakeSigner();
    const store = createFakeStore();
    const { token, jti } = await issueSessionToken({ subject: SUBJECT, budget: 2 }, signer, store);

    const result = await verifySessionToken(token, signer);

    expect(result).toEqual({ subject: SUBJECT, jti });
  });

  it("verifySessionToken returns null when the signer rejects the token", async () => {
    const signer = createFakeSigner();

    const result = await verifySessionToken("not-a-real-token", signer);

    expect(result).toBeNull();
  });
});
