import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders eligible styling with the given text", () => {
    render(<StatusBadge status="eligible">Eligible now</StatusBadge>);

    const badge = screen.getByText("Eligible now");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-status-success-bg");
    expect(badge.className).toContain("text-status-success");
  });

  it("renders cooldown styling with the given text", () => {
    render(<StatusBadge status="cooldown">Eligible again on 4 October</StatusBadge>);

    const badge = screen.getByText("Eligible again on 4 October");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-status-caution-bg");
    expect(badge.className).toContain("text-status-caution");
  });
});
