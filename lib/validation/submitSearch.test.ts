import { describe, expect, it } from "vitest";
import { submitSearchSchema } from "./submitSearch";

const validInput = {
  searcherName: "Zara Ahmed",
  bloodType: "O_NEG",
  area: "Gulberg",
};

describe("submitSearchSchema", () => {
  it("accepts a fully valid submission", () => {
    const result = submitSearchSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects a missing searcherName", () => {
    const { searcherName, ...rest } = validInput;
    const result = submitSearchSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a blank searcherName", () => {
    const result = submitSearchSchema.safeParse({ ...validInput, searcherName: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a missing bloodType", () => {
    const { bloodType, ...rest } = validInput;
    const result = submitSearchSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid bloodType", () => {
    const result = submitSearchSchema.safeParse({ ...validInput, bloodType: "Z_POS" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing area", () => {
    const { area, ...rest } = validInput;
    const result = submitSearchSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects an invalid area", () => {
    const result = submitSearchSchema.safeParse({ ...validInput, area: "Nowhere" });
    expect(result.success).toBe(false);
  });

  it("does not accept a searcherPhone field as part of the schema", () => {
    const parsed = submitSearchSchema.safeParse({
      ...validInput,
      searcherPhone: "+923001234567",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("searcherPhone");
    }
  });
});
