// @vitest-environment node
import { describe, expect, it, beforeAll, vi } from "vitest";
import type { TokenSigner } from "@/lib/domain/session";

let joseTokenSigner: TokenSigner;

beforeAll(async () => {
  process.env.JWT_SIGNING_KEY = "unit-test-signing-key-do-not-use-in-prod";
  ({ joseTokenSigner } = await import("./jwt"));
});

describe("joseTokenSigner", () => {
  it("round-trips sub/jti through sign then verify", async () => {
    const token = await joseTokenSigner.sign({ sub: "+923001234567", jti: "jti-1" }, 900);

    const result = await joseTokenSigner.verify(token);

    expect(result).toEqual({ sub: "+923001234567", jti: "jti-1" });
  });

  it("returns null for a tampered token", async () => {
    const token = await joseTokenSigner.sign({ sub: "+923001234567", jti: "jti-2" }, 900);
    const midpoint = Math.floor(token.length / 2);
    const flipped = token[midpoint] === "a" ? "b" : "a";
    const tampered = token.slice(0, midpoint) + flipped + token.slice(midpoint + 1);

    const result = await joseTokenSigner.verify(tampered);

    expect(result).toBeNull();
  });

  it("returns null for an expired token", async () => {
    vi.useFakeTimers();
    const token = await joseTokenSigner.sign({ sub: "+923001234567", jti: "jti-3" }, 900);
    vi.advanceTimersByTime(901 * 1000);

    const result = await joseTokenSigner.verify(token);

    expect(result).toBeNull();
    vi.useRealTimers();
  });

  it("returns null for a token signed with a different key", async () => {
    process.env.JWT_SIGNING_KEY = "a-completely-different-signing-key-here";
    vi.resetModules();
    const { joseTokenSigner: otherSigner } = await import("./jwt");
    const tokenFromOtherKey = await otherSigner.sign({ sub: "+923001234567", jti: "jti-4" }, 900);

    process.env.JWT_SIGNING_KEY = "unit-test-signing-key-do-not-use-in-prod";
    vi.resetModules();
    ({ joseTokenSigner } = await import("./jwt"));

    const result = await joseTokenSigner.verify(tokenFromOtherKey);

    expect(result).toBeNull();
  });
});
