import { z } from "zod";
import { E164_PHONE_REGEX } from "@/lib/validation/registerDonor";

export const selfServiceEntrySchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(E164_PHONE_REGEX, "Enter a valid phone number, e.g. +923001234567."),
});

export type SelfServiceEntryInput = z.infer<typeof selfServiceEntrySchema>;
