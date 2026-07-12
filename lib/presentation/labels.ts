import { AREA_VALUES, BLOOD_TYPE_VALUES } from "@/lib/validation/registerDonor";

export const AREA_LABELS: Record<(typeof AREA_VALUES)[number], string> = {
  JoharTown: "Johar Town",
  DHA: "DHA",
  Gulberg: "Gulberg",
  ModelTown: "Model Town",
  BahriaTown: "Bahria Town",
  Cantt: "Cantt",
  IqbalTown: "Iqbal Town",
  GardenTown: "Garden Town",
  WapdaTown: "Wapda Town",
  FaisalTown: "Faisal Town",
};

export const BLOOD_TYPE_LABELS: Record<
  (typeof BLOOD_TYPE_VALUES)[number],
  string
> = {
  A_POS: "A+",
  A_NEG: "A-",
  B_POS: "B+",
  B_NEG: "B-",
  AB_POS: "AB+",
  AB_NEG: "AB-",
  O_POS: "O+",
  O_NEG: "O-",
};
