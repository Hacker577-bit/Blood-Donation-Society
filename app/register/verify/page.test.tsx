import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const requestDonorOtpMock = vi.fn();
const verifyDonorOtpMock = vi.fn();
const pushMock = vi.fn();
const replaceMock = vi.fn();
let searchParamsValue = new URLSearchParams({ donorId: "donor_1" });

vi.mock("@/app/actions/requestDonorOtp", () => ({
  requestDonorOtp: (...args: unknown[]) => requestDonorOtpMock(...args),
}));

vi.mock("@/app/actions/verifyDonorOtp", () => ({
  verifyDonorOtp: (...args: unknown[]) => verifyDonorOtpMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  useSearchParams: () => searchParamsValue,
}));

import DonorOtpVerifyPage from "./page";

describe("Donor OTP Verify screen", () => {
  beforeEach(() => {
    requestDonorOtpMock.mockReset();
    verifyDonorOtpMock.mockReset();
    pushMock.mockReset();
    replaceMock.mockReset();
    searchParamsValue = new URLSearchParams({ donorId: "donor_1" });
    requestDonorOtpMock.mockResolvedValue({ requested: true });
  });

  it("auto-requests a code on mount", async () => {
    render(<DonorOtpVerifyPage />);

    await waitFor(() => expect(requestDonorOtpMock).toHaveBeenCalledWith({ donorId: "donor_1" }));
  });

  it("redirects to /register when donorId is missing from the query string", async () => {
    searchParamsValue = new URLSearchParams();
    render(<DonorOtpVerifyPage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/register"));
  });

  it("renders 6 digit boxes with position-based aria-labels", async () => {
    render(<DonorOtpVerifyPage />);

    for (let i = 1; i <= 6; i++) {
      expect(await screen.findByLabelText(`Code digit ${i} of 6`)).toBeInTheDocument();
    }
  });

  it("shows a distinct expired-code message on OTP_EXPIRED", async () => {
    const user = userEvent.setup();
    verifyDonorOtpMock.mockResolvedValue({
      error: { code: "OTP_EXPIRED", message: "This code has expired." },
    });
    render(<DonorOtpVerifyPage />);
    await screen.findByLabelText("Code digit 1 of 6");

    await user.click(screen.getByLabelText("Code digit 1 of 6"));
    await user.paste("123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This code has expired.");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a distinct wrong-code message on OTP_INCORRECT, different from expired", async () => {
    const user = userEvent.setup();
    verifyDonorOtpMock.mockResolvedValue({
      error: {
        code: "OTP_INCORRECT",
        message: "That code didn't match. Check the SMS and try again.",
      },
    });
    render(<DonorOtpVerifyPage />);
    await screen.findByLabelText("Code digit 1 of 6");

    await user.click(screen.getByLabelText("Code digit 1 of 6"));
    await user.paste("000000");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That code didn't match. Check the SMS and try again.",
    );
  });

  it("navigates to the Registration Confirmation screen on successful verification", async () => {
    const user = userEvent.setup();
    verifyDonorOtpMock.mockResolvedValue({ verified: true });
    render(<DonorOtpVerifyPage />);
    await screen.findByLabelText("Code digit 1 of 6");

    await user.click(screen.getByLabelText("Code digit 1 of 6"));
    await user.paste("123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/register/confirmation?donorId=donor_1"),
    );
  });

  it("disables Resend during the countdown and shows visible countdown text", async () => {
    render(<DonorOtpVerifyPage />);
    await screen.findByLabelText("Code digit 1 of 6");

    expect(screen.getByText(/Resend in 0:/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resend code" })).not.toBeInTheDocument();
  });
});
