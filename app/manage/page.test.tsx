import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const findDonorByGoogleIdMock = vi.fn();
const redirectMock = vi.fn();

let currentSession: { user: { id: string } | null } = { user: { id: "google-sub-1" } };

vi.mock("@/lib/auth", () => ({
  auth: async () => currentSession,
}));

vi.mock("@/lib/infra/repositories/donorRepository", () => ({
  findDonorByGoogleId: (...args: unknown[]) => findDonorByGoogleIdMock(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    redirectMock(path);
    throw new Error(`REDIRECT:${path}`);
  },
}));

import ManagePage from "./page";

describe("Manage screen", () => {
  beforeEach(() => {
    findDonorByGoogleIdMock.mockReset();
    redirectMock.mockReset();
    currentSession = { user: { id: "google-sub-1" } };
  });

  it("shows the Google sign-in button when there is no session", async () => {
    currentSession = { user: null };

    const jsx = await ManagePage();
    render(jsx);

    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /register as a donor/i })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("redirects to the dashboard when the signed-in Google account has a verified donor", async () => {
    findDonorByGoogleIdMock.mockResolvedValue({ id: "donor_1", phone: "+923001234567", isVerified: true });

    await expect(ManagePage()).rejects.toThrow("REDIRECT:/manage/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/manage/dashboard");
  });

  it("redirects to /register when the signed-in Google account has no verified donor", async () => {
    findDonorByGoogleIdMock.mockResolvedValue(null);

    await expect(ManagePage()).rejects.toThrow("REDIRECT:/register");
    expect(redirectMock).toHaveBeenCalledWith("/register");
  });

  it("redirects to /register when the signed-in Google account has an unverified donor", async () => {
    findDonorByGoogleIdMock.mockResolvedValue({ id: "donor_2", phone: "+923001234567", isVerified: false });

    await expect(ManagePage()).rejects.toThrow("REDIRECT:/register");
    expect(redirectMock).toHaveBeenCalledWith("/register");
  });
});
