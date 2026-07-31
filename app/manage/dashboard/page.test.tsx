import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const findDonorWithAreasByGoogleIdMock = vi.fn();
const redirectMock = vi.fn();

let currentSession: { user: { id: string } | null } = { user: { id: "google-sub-1" } };

vi.mock("@/lib/auth", () => ({
  auth: async () => currentSession,
}));

vi.mock("@/lib/infra/repositories/donorRepository", () => ({
  findDonorWithAreasByGoogleId: (...args: unknown[]) => findDonorWithAreasByGoogleIdMock(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    redirectMock(path);
    throw new Error(`REDIRECT:${path}`);
  },
}));

import SelfServiceDashboardPage from "./page";

const GOOGLE_ID = "google-sub-1";

const donor = {
  id: "clx0000000000000000000000",
  name: "Priya Sharma",
  bloodType: "B_POS",
  lastDonationDate: null,
  isVerified: true,
  areas: ["ModelTown", "IqbalTown"],
};

describe("Self-Service Dashboard", () => {
  beforeEach(() => {
    findDonorWithAreasByGoogleIdMock.mockReset();
    redirectMock.mockReset();
    currentSession = { user: { id: GOOGLE_ID } };
    findDonorWithAreasByGoogleIdMock.mockResolvedValue(donor);
  });

  it("renders the donor's name, eligibility, blood type, and areas", async () => {
    render(await SelfServiceDashboardPage());

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Priya Sharma");
    expect(screen.getByText("Eligible now")).toBeInTheDocument();
    expect(screen.getByText("B+")).toBeInTheDocument();
    expect(screen.getByText("Model Town")).toBeInTheDocument();
    expect(screen.getByText("Iqbal Town")).toBeInTheDocument();
  });

  it("shows the cooldown date for a donor inside the 90-day window", async () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 10);
    findDonorWithAreasByGoogleIdMock.mockResolvedValue({ ...donor, lastDonationDate: recent });

    render(await SelfServiceDashboardPage());

    expect(screen.getByText(/Eligible again on/)).toBeInTheDocument();
  });

  it("derives the rendered donor solely from the signed-in Google account", async () => {
    await SelfServiceDashboardPage();

    expect(findDonorWithAreasByGoogleIdMock).toHaveBeenCalledWith(GOOGLE_ID);
  });

  it("redirects to /manage when there is no Google session", async () => {
    currentSession = { user: null };

    await expect(SelfServiceDashboardPage()).rejects.toThrow("REDIRECT:/manage");
    expect(redirectMock).toHaveBeenCalledWith("/manage");
    expect(findDonorWithAreasByGoogleIdMock).not.toHaveBeenCalled();
  });

  it("redirects to /manage when the signed-in Google account matches no donor", async () => {
    findDonorWithAreasByGoogleIdMock.mockResolvedValue(null);

    await expect(SelfServiceDashboardPage()).rejects.toThrow("REDIRECT:/manage");
  });

  it("redirects to /manage for an unverified donor", async () => {
    findDonorWithAreasByGoogleIdMock.mockResolvedValue({ ...donor, isVerified: false });

    await expect(SelfServiceDashboardPage()).rejects.toThrow("REDIRECT:/manage");
  });

  it("renders no update or delete controls — those land in Stories 3.2 and 3.3", async () => {
    render(await SelfServiceDashboardPage());

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/update/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/delete/i)).not.toBeInTheDocument();
  });

  it("renders areas as static text, not interactive checkboxes", async () => {
    render(await SelfServiceDashboardPage());

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
