import { z } from "zod";
import { AREA_VALUES, BLOOD_TYPE_VALUES } from "@/lib/validation/registerDonor";

export const submitSearchSchema = z.object({
  searcherName: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(200, "Name is too long."),
  bloodType: z.enum(BLOOD_TYPE_VALUES, { error: "Select a blood type." }),
  area: z.enum(AREA_VALUES, { error: "Select an area." }),
});

export type SubmitSearchInput = z.infer<typeof submitSearchSchema>;
