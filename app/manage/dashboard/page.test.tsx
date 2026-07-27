import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const findDonorWithAreasMock = vi.fn();
const verifySessionTokenMock = vi.fn();
const consumeSessionUseMock = vi.fn();
const cookieGetMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("@/lib/infra/repositories/donorRepository", () => ({
  findDonorWithAreas: (...args: unknown[]) => findDonorWithAreasMock(...args),
}));

vi.mock("@/lib/domain/session", () => ({
  verifySessionToken: (...args: unknown[]) => verifySessionTokenMock(...args),
  consumeSessionUse: (...args: unknown[]) => consumeSessionUseMock(...args),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (...args: unknown[]) => cookieGetMock(...args) }),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    redirectMock(path);
    throw new Error(`REDIRECT:${path}`);
  },
}));

vi.mock("@/lib/infra/jwt", () => ({ joseTokenSigner: {} }));
vi.mock("@/lib/infra/sessionStore", () => ({ redisSessionBudgetStore: {} }));

import SelfServiceDashboardPage from "./page";

const DONOR_ID = "clx0000000000000000000000";
const OTHER_DONOR_ID = "clx1111111111111111111111";

const donor = {
  id: DONOR_ID,
  name: "Priya Sharma",
  bloodType: "B_POS",
  lastDonationDate: null,
  isVerified: true,
  areas: ["ModelTown", "IqbalTown"],
};

describe("Self-Service Dashboard", () => {
  beforeEach(() => {
    findDonorWithAreasMock.mockReset();
    verifySessionTokenMock.mockReset();
    consumeSessionUseMock.mockReset();
    cookieGetMock.mockReset();
    redirectMock.mockReset();

    cookieGetMock.mockReturnValue({ value: "signed-jwt-token" });
    verifySessionTokenMock.mockResolvedValue({ subject: DONOR_ID, jti: "jti-1" });
    findDonorWithAreasMock.mockResolvedValue(donor);
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
    findDonorWithAreasMock.mockResolvedValue({ ...donor, lastDonationDate: recent });

    render(await SelfServiceDashboardPage());

    expect(screen.getByText(/Eligible again on/)).toBeInTheDocument();
  });

  it("derives the rendered donor solely from the token subject", async () => {
    await SelfServiceDashboardPage();

    expect(findDonorWithAreasMock).toHaveBeenCalledWith(DONOR_ID);
  });

  it("renders another donor only when the token says so — identity comes from nowhere else", async () => {
    verifySessionTokenMock.mockResolvedValue({ subject: OTHER_DONOR_ID, jti: "jti-2" });
    findDonorWithAreasMock.mockResolvedValue({
      ...donor,
      id: OTHER_DONOR_ID,
      name: "Rohan Khan",
    });

    render(await SelfServiceDashboardPage());

    expect(findDonorWithAreasMock).toHaveBeenCalledWith(OTHER_DONOR_ID);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Rohan Khan");
    expect(screen.queryByText("Priya Sharma")).not.toBeInTheDocument();
  });

  it("does not consume the session budget — the donor must arrive with their one action intact", async () => {
    await SelfServiceDashboardPage();

    expect(consumeSessionUseMock).not.toHaveBeenCalled();
  });

  it("redirects to /manage when no session cookie is present", async () => {
    cookieGetMock.mockReturnValue(undefined);

    await expect(SelfServiceDashboardPage()).rejects.toThrow("REDIRECT:/manage");
    expect(redirectMock).toHaveBeenCalledWith("/manage");
    expect(findDonorWithAreasMock).not.toHaveBeenCalled();
  });

  it("redirects to /manage when the token is expired, tampered, or signed with another key", async () => {
    verifySessionTokenMock.mockResolvedValue(null);

    await expect(SelfServiceDashboardPage()).rejects.toThrow("REDIRECT:/manage");
    expect(findDonorWithAreasMock).not.toHaveBeenCalled();
  });

  it("redirects to /manage when the token's subject matches no donor", async () => {
    findDonorWithAreasMock.mockResolvedValue(null);

    await expect(SelfServiceDashboardPage()).rejects.toThrow("REDIRECT:/manage");
  });

  it("redirects to /manage for an unverified donor", async () => {
    findDonorWithAreasMock.mockResolvedValue({ ...donor, isVerified: false });

    await expect(SelfServiceDashboardPage()).rejects.toThrow("REDIRECT:/manage");
  });

  it("reads the token from the self_service_session cookie", async () => {
    await SelfServiceDashboardPage();

    expect(cookieGetMock).toHaveBeenCalledWith("self_service_session");
    expect(verifySessionTokenMock.mock.calls[0][0]).toBe("signed-jwt-token");
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
