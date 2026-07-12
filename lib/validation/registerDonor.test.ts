import { describe, expect, it } from "vitest";
import { registerDonorSchema } from "./registerDonor";

const validInput = {
  name: "Priya Sharma",
  phone: "+923001234567",
  bloodType: "B_POS" as const,
  areas: ["ModelTown" as const, "IqbalTown" as const],
  email: "",
  lastDonationDate: null,
};

describe("registerDonorSchema", () => {
  it("accepts a fully valid submission", () => {
    const result = registerDonorSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts multiple areas", () => {
    const result = registerDonorSchema.safeParse({
      ...validInput,
      areas: ["DHA", "Gulberg", "Cantt"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing blood type", () => {
    const { bloodType, ...rest } = validInput;
    const result = registerDonorSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a missing phone", () => {
    const { phone, ...rest } = validInput;
    const result = registerDonorSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a malformed (non-E.164) phone", () => {
    const result = registerDonorSchema.safeParse({
      ...validInput,
      phone: "03001234567",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty areas array", () => {
    const result = registerDonorSchema.safeParse({ ...validInput, areas: [] });
    expect(result.success).toBe(false);
  });

  it("accepts a blank email (optional)", () => {
    const result = registerDonorSchema.safeParse({ ...validInput, email: "" });
    expect(result.success).toBe(true);
  });

  it("accepts a missing email entirely", () => {
    const { email, ...rest } = validInput;
    const result = registerDonorSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = registerDonorSchema.safeParse({
      ...validInput,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a null lastDonationDate (never donated)", () => {
    const result = registerDonorSchema.safeParse({
      ...validInput,
      lastDonationDate: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid real calendar date", () => {
    const result = registerDonorSchema.safeParse({
      ...validInput,
      lastDonationDate: "2026-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a calendar-invalid date that matches the YYYY-MM-DD shape", () => {
    const result = registerDonorSchema.safeParse({
      ...validInput,
      lastDonationDate: "2024-13-45",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a February 30th", () => {
    const result = registerDonorSchema.safeParse({
      ...validInput,
      lastDonationDate: "2024-02-30",
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate areas", () => {
    const result = registerDonorSchema.safeParse({
      ...validInput,
      areas: ["DHA", "DHA"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a name over the max length", () => {
    const result = registerDonorSchema.safeParse({
      ...validInput,
      name: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an email over the max length", () => {
    const result = registerDonorSchema.safeParse({
      ...validInput,
      email: `${"a".repeat(250)}@example.com`,
    });
    expect(result.success).toBe(false);
  });
});
