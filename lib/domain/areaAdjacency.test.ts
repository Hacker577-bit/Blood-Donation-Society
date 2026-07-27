import { describe, expect, it } from "vitest";
import { AREA_VALUES } from "@/lib/validation/registerDonor";
import { AREA_ADJACENCY, getNearbyAreas } from "./areaAdjacency";

type AreaValue = (typeof AREA_VALUES)[number];

describe("AREA_ADJACENCY", () => {
  it("covers every area in AREA_VALUES", () => {
    for (const area of AREA_VALUES) {
      expect(AREA_ADJACENCY[area]).toBeDefined();
    }
    expect(Object.keys(AREA_ADJACENCY).sort()).toEqual([...AREA_VALUES].sort());
  });

  it("lists only known areas as neighbours", () => {
    for (const area of AREA_VALUES) {
      for (const neighbour of AREA_ADJACENCY[area]) {
        expect(AREA_VALUES).toContain(neighbour);
      }
    }
  });

  it("never lists an area as its own neighbour", () => {
    for (const area of AREA_VALUES) {
      expect(AREA_ADJACENCY[area]).not.toContain(area);
    }
  });

  it("is symmetric — if B is nearby A, then A is nearby B", () => {
    for (const area of AREA_VALUES) {
      for (const neighbour of AREA_ADJACENCY[area]) {
        expect(AREA_ADJACENCY[neighbour as AreaValue]).toContain(area);
      }
    }
  });

  it("gives every area at least one neighbour, so expansion is never a guaranteed dead end", () => {
    for (const area of AREA_VALUES) {
      expect(AREA_ADJACENCY[area].length).toBeGreaterThan(0);
    }
  });

  it("lists each neighbour at most once per area", () => {
    for (const area of AREA_VALUES) {
      const neighbours = AREA_ADJACENCY[area];
      expect(new Set(neighbours).size).toBe(neighbours.length);
    }
  });
  it("is frozen at runtime, so a stray mutation cannot silently corrupt later expansions", () => {
    expect(Object.isFrozen(AREA_ADJACENCY)).toBe(true);
    for (const area of AREA_VALUES) {
      expect(Object.isFrozen(AREA_ADJACENCY[area])).toBe(true);
    }

    const mutableView = AREA_ADJACENCY as unknown as Record<string, string[]>;
    expect(() => mutableView.DHA.push("Atlantis")).toThrow();
    expect(() => {
      mutableView.DHA = [];
    }).toThrow();
    expect(AREA_ADJACENCY.DHA).toEqual(["Cantt", "Gulberg"]);
  });
});

describe("getNearbyAreas", () => {
  it("returns the configured neighbours for a known area", () => {
    expect(getNearbyAreas("DHA")).toEqual([...AREA_ADJACENCY.DHA]);
  });

  it("returns a fresh copy each call, so a caller cannot mutate the shared table", () => {
    const first = getNearbyAreas("DHA");
    const second = getNearbyAreas("DHA");

    expect(first).not.toBe(second);
    expect(first).not.toBe(AREA_ADJACENCY.DHA);

    first.push("Atlantis" as never);
    expect(getNearbyAreas("DHA")).toEqual(["Cantt", "Gulberg"]);
  });

  it("returns an empty array for an unrecognised area rather than throwing", () => {
    expect(getNearbyAreas("Atlantis")).toEqual([]);
  });
});
