import { z } from "zod";

export const AREA_VALUES = [
  "JoharTown",
  "DHA",
  "Gulberg",
  "ModelTown",
  "BahriaTown",
  "Cantt",
  "IqbalTown",
  "GardenTown",
  "WapdaTown",
  "FaisalTown",
] as const;

export const BLOOD_TYPE_VALUES = [
  "A_POS",
  "A_NEG",
  "B_POS",
  "B_NEG",
  "AB_POS",
  "AB_NEG",
  "O_POS",
  "O_NEG",
] as const;

export const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const registerDonorSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(200, "Name is too long."),
  phone: z
    .string()
    .trim()
    .regex(E164_PHONE_REGEX, "Enter a valid phone number, e.g. +923001234567."),
  bloodType: z.enum(BLOOD_TYPE_VALUES, {
    error: "Select your blood type.",
  }),
  areas: z
    .array(z.enum(AREA_VALUES))
    .min(1, "Select at least one area.")
    .refine((areas) => new Set(areas).size === areas.length, {
      error: "Each area can only be selected once.",
    }),
  email: z
    .union([
      z.literal(""),
      z.string().trim().max(254, "Email is too long.").email("Enter a valid email address."),
    ])
    .optional(),
  lastDonationDate: z
    .string()
    .trim()
    .regex(ISO_DATE_REGEX, "Enter a valid date.")
    .refine(isRealCalendarDate, "Enter a valid date.")
    .nullable()
    .optional(),
});

export type RegisterDonorInput = z.infer<typeof registerDonorSchema>;
