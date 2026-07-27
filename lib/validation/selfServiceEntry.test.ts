import { describe, expect, it } from "vitest";
import { selfServiceEntrySchema } from "./selfServiceEntry";

describe("selfServiceEntrySchema", () => {
  it("accepts a valid E.164 phone number", () => {
    const result = selfServiceEntrySchema.safeParse({ phone: "+923001234567" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing phone", () => {
    const result = selfServiceEntrySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a malformed (non-E.164) phone", () => {
    const result = selfServiceEntrySchema.safeParse({ phone: "03001234567" });
    expect(result.success).toBe(false);
  });

  it("surfaces the shared phone message so all three flows read identically", () => {
    const result = selfServiceEntrySchema.safeParse({ phone: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Enter a valid phone number, e.g. +923001234567.",
      );
    }
  });

  it("trims surrounding whitespace so the lookup key matches the OTP challenge key", () => {
    const result = selfServiceEntrySchema.safeParse({ phone: "  +923001234567  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("+923001234567");
    }
  });

  it("does not require a name — self-service collects phone only", () => {
    const result = selfServiceEntrySchema.safeParse({ phone: "+923001234567" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).toEqual(["phone"]);
    }
  });
});
