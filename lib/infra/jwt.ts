import { SignJWT, jwtVerify } from "jose";
import type { TokenSigner } from "@/lib/domain/session";

function getSecretKey(): Uint8Array {
  if (!process.env.JWT_SIGNING_KEY) {
    throw new Error("JWT_SIGNING_KEY must be set before using the JWT signer.");
  }
  return new TextEncoder().encode(process.env.JWT_SIGNING_KEY);
}

const secretKey = getSecretKey();

export const joseTokenSigner: TokenSigner = {
  async sign({ sub, jti }, ttlSeconds) {
    return new SignJWT({ sub })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setJti(jti)
      .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
      .sign(secretKey);
  },

  async verify(token) {
    try {
      const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
      if (typeof payload.sub !== "string" || typeof payload.jti !== "string") {
        return null;
      }
      return { sub: payload.sub, jti: payload.jti };
    } catch {
      // Never throw across this port boundary (any invalid/expired/malformed
      // token, or an unexpected verification failure, is just "not valid").
      return null;
    }
  },
};
