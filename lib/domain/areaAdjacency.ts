import { AREA_VALUES } from "@/lib/validation/registerDonor";

type AreaValue = (typeof AREA_VALUES)[number];

export type { AreaValue };

/**
 * AD-7: area adjacency is static, versioned code — never a DB table, seed, or admin-editable resource.
 *
 * These concrete values are a WORKING ASSUMPTION, not a product decision. PRD Open Question 1
 * ("What 'nearby areas' adjacency exists between Lahore's ten predefined localities?") is still open.
 * Swap the values freely when PM answers it — but preserve these invariants, which areaAdjacency.test.ts
 * enforces by property rather than by restating the table:
 *   - symmetric: B in AREA_ADJACENCY[A] implies A in AREA_ADJACENCY[B]
 *   - no self-reference: A is never in AREA_ADJACENCY[A]
 *   - every area has at least one neighbour, so expansion is never a guaranteed dead end
 *   - every neighbour is a member of AREA_VALUES
 *
 * Typing this as a total Record over AREA_VALUES makes a missing area a compile error.
 */
export const AREA_ADJACENCY: Record<AreaValue, ReadonlyArray<AreaValue>> = Object.freeze({
  JoharTown: Object.freeze(["ModelTown", "FaisalTown", "WapdaTown", "IqbalTown", "GardenTown", "BahriaTown"]),
  DHA: Object.freeze(["Cantt", "Gulberg"]),
  Gulberg: Object.freeze(["ModelTown", "Cantt", "GardenTown", "DHA"]),
  ModelTown: Object.freeze(["Gulberg", "FaisalTown", "GardenTown", "JoharTown"]),
  BahriaTown: Object.freeze(["JoharTown", "WapdaTown"]),
  Cantt: Object.freeze(["DHA", "Gulberg"]),
  IqbalTown: Object.freeze(["JoharTown", "WapdaTown"]),
  GardenTown: Object.freeze(["ModelTown", "Gulberg", "FaisalTown", "JoharTown"]),
  WapdaTown: Object.freeze(["JoharTown", "IqbalTown", "FaisalTown", "BahriaTown"]),
  FaisalTown: Object.freeze(["ModelTown", "GardenTown", "JoharTown", "WapdaTown"]),
} as Record<AreaValue, ReadonlyArray<AreaValue>>);

/**
 * Returns the `Area` enum members adjacent to `area`, or `[]` if `area` is not a known Area.
 * The typed return keeps adjacency values checkable against Prisma's `Area` enum all the way to
 * the repository, rather than degrading to `string` at the port boundary.
 */
export function getNearbyAreas(area: string): AreaValue[] {
  return [...(AREA_ADJACENCY[area as AreaValue] ?? [])];
}
