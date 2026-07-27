import { describe, expect, it } from "vitest";
import { expandSearchSchema } from "./expandSearch";

const validInput = {
  searcherName: "Zara Ahmed",
  bloodType: "O_NEG",
  originArea: "Gulberg",
};

describe("expandSearchSchema", () => {
  it("accepts a fully valid expansion request", () => {
    const result = expandSearchSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects a missing searcherName", () => {
    const { searcherName, ...rest } = validInput;
    const result = expandSearchSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a blank searcherName", () => {
    const result = expandSearchSchema.safeParse({ ...validInput, searcherName: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a missing bloodType", () => {
    const { bloodType, ...rest } = validInput;
    const result = expandSearchSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid bloodType", () => {
    const result = expandSearchSchema.safeParse({ ...validInput, bloodType: "Z_POS" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing originArea", () => {
    const { originArea, ...rest } = validInput;
    const result = expandSearchSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid originArea", () => {
    const result = expandSearchSchema.safeParse({ ...validInput, originArea: "Nowhere" });
    expect(result.success).toBe(false);
  });

  it("does not accept a searcherPhone field as part of the schema", () => {
    const parsed = expandSearchSchema.safeParse({
      ...validInput,
      searcherPhone: "+923001234567",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("searcherPhone");
    }
  });
});
