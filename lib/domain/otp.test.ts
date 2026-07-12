import { describe, expect, it, vi, beforeEach } from "vitest";
import { requestOtp, verifyOtp, type OtpChallenge, type OtpChallengeStore, type OtpSender } from "./otp";

function createFakeStore(): OtpChallengeStore & { data: Map<string, OtpChallenge> } {
  const data = new Map<string, OtpChallenge>();
  return {
    data,
    async save(key, value) {
      data.set(key, value);
    },
    async get(key) {
      return data.get(key) ?? null;
    },
    async incrementAttempts(key) {
      const existing = data.get(key);
      if (existing) {
        data.set(key, { ...existing, attempts: existing.attempts + 1 });
      }
    },
    async delete(key) {
      data.delete(key);
    },
  };
}

function createFakeSender(): OtpSender & { sentTo: Array<{ phone: string; code: string }> } {
  const sentTo: Array<{ phone: string; code: string }> = [];
  return {
    sentTo,
    async send(phone, code) {
      sentTo.push({ phone, code });
    },
  };
}

const PHONE = "+923001234567";
const PURPOSE = "donor_registration";

describe("otp domain service", () => {
  let store: ReturnType<typeof createFakeStore>;
  let sender: ReturnType<typeof createFakeSender>;

  beforeEach(() => {
    store = createFakeStore();
    sender = createFakeSender();
    vi.useRealTimers();
  });

  it("verifies successfully with the correct code before expiry", async () => {
    await requestOtp({ phone: PHONE, purpose: PURPOSE }, store, sender);
    const { code } = sender.sentTo[0];

    const result = await verifyOtp({ phone: PHONE, purpose: PURPOSE, code }, store);

    expect(result.status).toBe("verified");
  });

  it("never stores the plaintext code, only a hash", async () => {
    await requestOtp({ phone: PHONE, purpose: PURPOSE }, store, sender);
    const { code } = sender.sentTo[0];
    const stored = store.data.get(`${PHONE}:${PURPOSE}`);

    expect(stored?.codeHash).not.toBe(code);
    expect(stored?.codeHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns expired for a code submitted after the TTL", async () => {
    vi.useFakeTimers();
    await requestOtp({ phone: PHONE, purpose: PURPOSE }, store, sender);
    const { code } = sender.sentTo[0];

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    const result = await verifyOtp({ phone: PHONE, purpose: PURPOSE, code }, store);

    expect(result.status).toBe("expired");
    vi.useRealTimers();
  });

  it("returns wrong_code and increments attempts for an incorrect, non-expired code", async () => {
    await requestOtp({ phone: PHONE, purpose: PURPOSE }, store, sender);

    const result = await verifyOtp({ phone: PHONE, purpose: PURPOSE, code: "000000" }, store);

    expect(result.status).toBe("wrong_code");
    expect(store.data.get(`${PHONE}:${PURPOSE}`)?.attempts).toBe(1);
  });

  it("returns not_found for a phone/purpose with no active challenge", async () => {
    const result = await verifyOtp({ phone: PHONE, purpose: PURPOSE, code: "123456" }, store);

    expect(result.status).toBe("not_found");
  });

  it("cannot reuse a code after it has been verified once", async () => {
    await requestOtp({ phone: PHONE, purpose: PURPOSE }, store, sender);
    const { code } = sender.sentTo[0];

    const first = await verifyOtp({ phone: PHONE, purpose: PURPOSE, code }, store);
    const second = await verifyOtp({ phone: PHONE, purpose: PURPOSE, code }, store);

    expect(first.status).toBe("verified");
    expect(second.status).toBe("not_found");
  });

  it("keeps different purposes for the same phone independent", async () => {
    await requestOtp({ phone: PHONE, purpose: "donor_registration" }, store, sender);
    await requestOtp({ phone: PHONE, purpose: "self_service" }, store, sender);

    expect(store.data.size).toBe(2);
    expect(store.data.has(`${PHONE}:donor_registration`)).toBe(true);
    expect(store.data.has(`${PHONE}:self_service`)).toBe(true);
  });
});
