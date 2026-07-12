export interface TokenSigner {
  sign(payload: { sub: string; jti: string }, ttlSeconds: number): Promise<string>;
  verify(token: string): Promise<{ sub: string; jti: string } | null>;
}

export interface SessionBudgetStore {
  initialize(jti: string, budget: number, ttlSeconds: number): Promise<void>;
  consume(jti: string): Promise<{ allowed: boolean; remaining: number } | null>;
}

const SESSION_TTL_SECONDS = 15 * 60;

export async function issueSessionToken(
  { subject, budget }: { subject: string; budget: number },
  signer: TokenSigner,
  store: SessionBudgetStore,
): Promise<{ token: string; jti: string }> {
  const jti = crypto.randomUUID();

  const token = await signer.sign({ sub: subject, jti }, SESSION_TTL_SECONDS);
  await store.initialize(jti, budget, SESSION_TTL_SECONDS);

  return { token, jti };
}

export async function consumeSessionUse(
  jti: string,
  store: SessionBudgetStore,
): Promise<{ allowed: boolean; remaining: number }> {
  const result = await store.consume(jti);
  return result ?? { allowed: false, remaining: 0 };
}

export async function verifySessionToken(
  token: string,
  signer: TokenSigner,
): Promise<{ subject: string; jti: string } | null> {
  const verified = await signer.verify(token);
  if (!verified) {
    return null;
  }
  return { subject: verified.sub, jti: verified.jti };
}
