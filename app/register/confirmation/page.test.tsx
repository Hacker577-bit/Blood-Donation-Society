import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const findDonorWithAreasMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("@/lib/infra/repositories/donorRepository", () => ({
  findDonorWithAreas: (...args: unknown[]) => findDonorWithAreasMock(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    redirectMock(path);
    throw new Error(`REDIRECT:${path}`);
  },
}));

import RegistrationConfirmationPage from "./page";

describe("Registration Confirmation screen", () => {
  beforeEach(() => {
    findDonorWithAreasMock.mockReset();
    redirectMock.mockReset();
  });

  it("renders 'Eligible now' and the donor's areas for an eligible, verified donor", async () => {
    findDonorWithAreasMock.mockResolvedValue({
      id: "donor_1",
      name: "Priya Sharma",
      bloodType: "B_POS",
      lastDonationDate: null,
      isVerified: true,
      areas: ["ModelTown", "IqbalTown"],
    });

    const jsx = await RegistrationConfirmationPage({
      searchParams: Promise.resolve({ donorId: "donor_1" }),
    });
    render(jsx);

    expect(screen.getByText("Eligible now")).toBeInTheDocument();
    expect(screen.getByText("Model Town")).toBeInTheDocument();
    expect(screen.getByText("Iqbal Town")).toBeInTheDocument();
  });

  it("renders 'Eligible again on [date]' with a formatted date for a donor in cooldown", async () => {
    findDonorWithAreasMock.mockResolvedValue({
      id: "donor_2",
      name: "Rohan Khan",
      bloodType: "O_NEG",
      lastDonationDate: new Date("2026-07-01T00:00:00.000Z"),
      isVerified: true,
      areas: ["DHA"],
    });

    const jsx = await RegistrationConfirmationPage({
      searchParams: Promise.resolve({ donorId: "donor_2" }),
    });
    render(jsx);

    expect(screen.getByText(/Eligible again on \d+ \w+/)).toBeInTheDocument();
    expect(screen.queryByText(/in \d+ days/)).not.toBeInTheDocument();
  });

  it("redirects to /register when donorId is missing", async () => {
    await expect(
      RegistrationConfirmationPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/register");

    expect(redirectMock).toHaveBeenCalledWith("/register");
    expect(findDonorWithAreasMock).not.toHaveBeenCalled();
  });

  it("redirects to /register when the donor does not exist", async () => {
    findDonorWithAreasMock.mockResolvedValue(null);

    await expect(
      RegistrationConfirmationPage({ searchParams: Promise.resolve({ donorId: "missing" }) }),
    ).rejects.toThrow("REDIRECT:/register");

    expect(redirectMock).toHaveBeenCalledWith("/register");
  });

  it("redirects to Donor OTP Verify when the donor is not yet verified", async () => {
    findDonorWithAreasMock.mockResolvedValue({
      id: "donor_3",
      name: "Unverified Donor",
      bloodType: "A_POS",
      lastDonationDate: null,
      isVerified: false,
      areas: ["Cantt"],
    });

    await expect(
      RegistrationConfirmationPage({ searchParams: Promise.resolve({ donorId: "donor_3" }) }),
    ).rejects.toThrow("REDIRECT:/register/verify?donorId=donor_3");

    expect(redirectMock).toHaveBeenCalledWith("/register/verify?donorId=donor_3");
  });
});
