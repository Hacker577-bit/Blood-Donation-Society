import { describe, expect, it } from "vitest";
import { searcherVerifySchema } from "./searcherVerify";

const validInput = {
  name: "Amara Khan",
  phone: "+923001234567",
};

describe("searcherVerifySchema", () => {
  it("accepts a fully valid submission", () => {
    const result = searcherVerifySchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const { name, ...rest } = validInput;
    const result = searcherVerifySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a blank name", () => {
    const result = searcherVerifySchema.safeParse({ ...validInput, name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a missing phone", () => {
    const { phone, ...rest } = validInput;
    const result = searcherVerifySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a malformed (non-E.164) phone", () => {
    const result = searcherVerifySchema.safeParse({ ...validInput, phone: "03001234567" });
    expect(result.success).toBe(false);
  });
});
