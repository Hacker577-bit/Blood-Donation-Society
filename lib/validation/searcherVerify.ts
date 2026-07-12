import { z } from "zod";
import { E164_PHONE_REGEX } from "@/lib/validation/registerDonor";

export const searcherVerifySchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(200, "Name is too long."),
  phone: z
    .string()
    .trim()
    .regex(E164_PHONE_REGEX, "Enter a valid phone number, e.g. +923001234567."),
});

export type SearcherVerifyInput = z.infer<typeof searcherVerifySchema>;
