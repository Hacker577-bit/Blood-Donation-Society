import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home", () => {
  it("offers the three-way fork with the IA's exact labels and destinations", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: "I need blood" })).toHaveAttribute(
      "href",
      "/search",
    );
    expect(screen.getByRole("link", { name: "I want to help" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(
      screen.getByRole("link", { name: "Manage my registration" }),
    ).toHaveAttribute("href", "/manage");
  });

  it("renders exactly three navigation links, so no fourth path competes for attention", () => {
    render(<Home />);

    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("renders a single top-level heading", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("gives every fork a tap target at or above the 44px floor", () => {
    render(<Home />);

    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toMatch(/min-h-\[4[48]px\]/);
    }
  });
});
