import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const requestSearcherOtpMock = vi.fn();
const verifySearcherOtpMock = vi.fn();
const pushMock = vi.fn();

vi.mock("@/app/actions/requestSearcherOtp", () => ({
  requestSearcherOtp: (...args: unknown[]) => requestSearcherOtpMock(...args),
}));

vi.mock("@/app/actions/verifySearcherOtp", () => ({
  verifySearcherOtp: (...args: unknown[]) => verifySearcherOtpMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import SearcherVerifyPage from "./page";

async function fillDetailsAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Amara Khan");
  await user.type(screen.getByLabelText("Phone number"), "+923001234567");
  const submit = screen.getByRole("button", { name: "Submit" });
  await waitFor(() => expect(submit).toBeEnabled());
  await user.click(submit);
}

describe("Searcher Verify screen", () => {
  beforeEach(() => {
    requestSearcherOtpMock.mockReset();
    verifySearcherOtpMock.mockReset();
    pushMock.mockReset();
    requestSearcherOtpMock.mockResolvedValue({ requested: true });
  });

  it("keeps Submit disabled until name and phone are valid", async () => {
    const user = userEvent.setup();
    render(<SearcherVerifyPage />);

    const submit = screen.getByRole("button", { name: "Submit" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Name"), "Amara Khan");
    await user.type(screen.getByLabelText("Phone number"), "+923001234567");

    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("shows an inline error below the phone field on blur when invalid", async () => {
    const user = userEvent.setup();
    render(<SearcherVerifyPage />);

    const phone = screen.getByLabelText("Phone number");
    await user.type(phone, "123");
    await user.tab();

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid phone number/i);
  });

  it("requests an OTP and transitions to the code-entry step on valid submit", async () => {
    const user = userEvent.setup();
    render(<SearcherVerifyPage />);

    await fillDetailsAndSubmit(user);

    expect(requestSearcherOtpMock).toHaveBeenCalledWith({
      name: "Amara Khan",
      phone: "+923001234567",
    });
    for (let i = 1; i <= 6; i++) {
      expect(await screen.findByLabelText(`Code digit ${i} of 6`)).toBeInTheDocument();
    }
  });

  it("shows a distinct expired-code message on OTP_EXPIRED", async () => {
    const user = userEvent.setup();
    verifySearcherOtpMock.mockResolvedValue({
      error: { code: "OTP_EXPIRED", message: "This code has expired." },
    });
    render(<SearcherVerifyPage />);
    await fillDetailsAndSubmit(user);
    await screen.findByLabelText("Code digit 1 of 6");

    await user.click(screen.getByLabelText("Code digit 1 of 6"));
    await user.paste("123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This code has expired.");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a distinct wrong-code message on OTP_INCORRECT, different from expired", async () => {
    const user = userEvent.setup();
    verifySearcherOtpMock.mockResolvedValue({
      error: {
        code: "OTP_INCORRECT",
        message: "That code didn't match. Check the SMS and try again.",
      },
    });
    render(<SearcherVerifyPage />);
    await fillDetailsAndSubmit(user);
    await screen.findByLabelText("Code digit 1 of 6");

    await user.click(screen.getByLabelText("Code digit 1 of 6"));
    await user.paste("000000");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That code didn't match. Check the SMS and try again.",
    );
  });

  it("navigates to /search with the session token and name on successful verification", async () => {
    const user = userEvent.setup();
    verifySearcherOtpMock.mockResolvedValue({
      verified: true,
      sessionToken: "signed-jwt-token",
    });
    render(<SearcherVerifyPage />);
    await fillDetailsAndSubmit(user);
    await screen.findByLabelText("Code digit 1 of 6");

    await user.click(screen.getByLabelText("Code digit 1 of 6"));
    await user.paste("123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        "/search?sessionToken=signed-jwt-token&name=Amara+Khan",
      ),
    );
  });

  it("disables Resend during the countdown and shows visible countdown text", async () => {
    const user = userEvent.setup();
    render(<SearcherVerifyPage />);
    await fillDetailsAndSubmit(user);
    await screen.findByLabelText("Code digit 1 of 6");

    expect(screen.getByText(/Resend in 0:/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resend code" })).not.toBeInTheDocument();
  });

  it("resend calls requestSearcherOtp again with the same name/phone", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    render(<SearcherVerifyPage />);
    await fillDetailsAndSubmit(user);
    await screen.findByLabelText("Code digit 1 of 6");
    requestSearcherOtpMock.mockClear();

    await vi.advanceTimersByTimeAsync(45 * 1000);

    const resendButton = await screen.findByRole("button", { name: "Resend code" });
    await user.click(resendButton);

    expect(requestSearcherOtpMock).toHaveBeenCalledWith({
      name: "Amara Khan",
      phone: "+923001234567",
    });
    vi.useRealTimers();
  });
});
