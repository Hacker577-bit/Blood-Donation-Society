import { z } from "zod";
import { AREA_VALUES, BLOOD_TYPE_VALUES, E164_PHONE_REGEX } from "@/lib/validation/registerDonor";

export const submitSearchSchema = z.object({
  searcherName: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(200, "Name is too long."),
  searcherPhone: z
    .string()
    .trim()
    .regex(E164_PHONE_REGEX, "Enter a valid phone number, e.g. +923001234567."),
  bloodType: z.enum(BLOOD_TYPE_VALUES, { error: "Select a blood type." }),
  area: z.enum(AREA_VALUES, { error: "Select an area." }),
});

export type SubmitSearchInput = z.infer<typeof submitSearchSchema>;
