import { createHash, randomInt } from "node:crypto";

export interface OtpChallenge {
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

export interface OtpChallengeStore {
  save(key: string, value: OtpChallenge, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<OtpChallenge | null>;
  incrementAttempts(key: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface OtpSender {
  send(phone: string, code: string): Promise<void>;
}

export type VerifyOtpStatus = "verified" | "expired" | "wrong_code" | "not_found";

const OTP_TTL_SECONDS = 5 * 60;

function toChallengeKey(phone: string, purpose: string): string {
  return `${phone}:${purpose}`;
}

function hashCode(code: string, phone: string, purpose: string): string {
  return createHash("sha256").update(`${code}:${phone}:${purpose}`).digest("hex");
}

export async function requestOtp(
  { phone, purpose }: { phone: string; purpose: string },
  store: OtpChallengeStore,
  sender: OtpSender,
): Promise<void> {
  const code = randomInt(100000, 1000000).toString().padStart(6, "0");
  const codeHash = hashCode(code, phone, purpose);

  await store.save(
    toChallengeKey(phone, purpose),
    { codeHash, expiresAt: Date.now() + OTP_TTL_SECONDS * 1000, attempts: 0 },
    OTP_TTL_SECONDS,
  );

  await sender.send(phone, code);
}

export async function verifyOtp(
  { phone, purpose, code }: { phone: string; purpose: string; code: string },
  store: OtpChallengeStore,
): Promise<{ status: VerifyOtpStatus }> {
  const key = toChallengeKey(phone, purpose);
  const challenge = await store.get(key);

  if (!challenge) {
    return { status: "not_found" };
  }

  if (Date.now() > challenge.expiresAt) {
    return { status: "expired" };
  }

  const suppliedHash = hashCode(code, phone, purpose);
  if (suppliedHash !== challenge.codeHash) {
    await store.incrementAttempts(key);
    return { status: "wrong_code" };
  }

  await store.delete(key);
  return { status: "verified" };
}
