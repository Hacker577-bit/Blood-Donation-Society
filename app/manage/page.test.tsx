import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const requestSelfServiceOtpMock = vi.fn();
const verifySelfServiceOtpMock = vi.fn();

vi.mock("@/app/actions/requestSelfServiceOtp", () => ({
  requestSelfServiceOtp: (...args: unknown[]) => requestSelfServiceOtpMock(...args),
}));

vi.mock("@/app/actions/verifySelfServiceOtp", () => ({
  verifySelfServiceOtp: (...args: unknown[]) => verifySelfServiceOtpMock(...args),
}));

import ManagePage from "./page";

async function submitPhone(
  user: ReturnType<typeof userEvent.setup>,
  phone = "+923001234567",
) {
  await user.type(screen.getByLabelText("Phone number"), phone);
  const submit = screen.getByRole("button", { name: "Send code" });
  await waitFor(() => expect(submit).toBeEnabled());
  await user.click(submit);
}

async function enterCode(user: ReturnType<typeof userEvent.setup>, code: string) {
  const boxes = screen.getAllByRole("textbox");
  for (let i = 0; i < code.length; i++) {
    await user.type(boxes[i], code[i]);
  }
}

describe("Self-Service Entry screen", () => {
  beforeEach(() => {
    requestSelfServiceOtpMock.mockReset();
    verifySelfServiceOtpMock.mockReset();
    requestSelfServiceOtpMock.mockResolvedValue({ requested: true });
  });

  it("collects a phone number and no name — self-service does not ask who you are", () => {
    render(<ManagePage />);

    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("keeps the primary action disabled until the phone is valid", async () => {
    const user = userEvent.setup();
    render(<ManagePage />);

    const submit = screen.getByRole("button", { name: "Send code" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Phone number"), "+923001234567");

    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("shows an inline error below the phone field on blur when invalid", async () => {
    const user = userEvent.setup();
    render(<ManagePage />);

    await user.type(screen.getByLabelText("Phone number"), "123");
    await user.tab();

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid phone number/i);
  });

  it("requests an OTP and advances to the code step on success", async () => {
    const user = userEvent.setup();
    render(<ManagePage />);

    await submitPhone(user);

    expect(requestSelfServiceOtpMock).toHaveBeenCalledWith({ phone: "+923001234567" });
    expect(await screen.findByRole("heading", { name: /verify your phone/i })).toBeInTheDocument();
  });

  it("stays on one route so the phone number never enters the URL", async () => {
    const user = userEvent.setup();
    render(<ManagePage />);

    await submitPhone(user);

    // The phone lives in React state; step 2 passes it straight to the verify
    // action rather than through a query param.
    await screen.findByRole("heading", { name: /verify your phone/i });
    await enterCode(user, "123456");
    verifySelfServiceOtpMock.mockResolvedValue({
      error: { code: "OTP_INCORRECT", message: "That code didn't match. Check the SMS and try again." },
    });
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(verifySelfServiceOtpMock).toHaveBeenCalledWith({
      phone: "+923001234567",
      code: "123456",
    });
  });

  it("renders the distinct expired-code message, not a merged generic one", async () => {
    const user = userEvent.setup();
    render(<ManagePage />);
    await submitPhone(user);
    await screen.findByRole("heading", { name: /verify your phone/i });

    verifySelfServiceOtpMock.mockResolvedValue({
      error: { code: "OTP_EXPIRED", message: "This code has expired." },
    });
    await enterCode(user, "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByText("This code has expired.")).toBeInTheDocument();
  });

  it("renders the distinct wrong-code message", async () => {
    const user = userEvent.setup();
    render(<ManagePage />);
    await submitPhone(user);
    await screen.findByRole("heading", { name: /verify your phone/i });

    verifySelfServiceOtpMock.mockResolvedValue({
      error: {
        code: "OTP_INCORRECT",
        message: "That code didn't match. Check the SMS and try again.",
      },
    });
    await enterCode(user, "000000");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(
      await screen.findByText("That code didn't match. Check the SMS and try again."),
    ).toBeInTheDocument();
  });

  it("surfaces a rate-limit message from the request step", async () => {
    const user = userEvent.setup();
    requestSelfServiceOtpMock.mockResolvedValue({
      error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again shortly." },
    });
    render(<ManagePage />);

    await submitPhone(user);

    expect(
      await screen.findByText("Too many attempts. Please try again shortly."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /verify your phone/i })).not.toBeInTheDocument();
  });

  it("gives the resend control a tap target at or above the 44px floor", async () => {
    const user = userEvent.setup();
    render(<ManagePage />);
    await submitPhone(user);
    await screen.findByRole("heading", { name: /verify your phone/i });

    // The countdown is showing, so the control is the disabled-state element.
    expect(screen.getByTestId("resend-control").className).toMatch(/min-h-\[44px\]/);
  });

  it("shows the catch-all rather than dying silently when the action throws", async () => {
    const user = userEvent.setup();
    render(<ManagePage />);
    await submitPhone(user);
    await screen.findByRole("heading", { name: /verify your phone/i });

    verifySelfServiceOtpMock.mockRejectedValue(new Error("network down"));
    await enterCode(user, "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeInTheDocument();
  });

  it("re-enables Verify after a failure, so the donor can retry", async () => {
    const user = userEvent.setup();
    render(<ManagePage />);
    await submitPhone(user);
    await screen.findByRole("heading", { name: /verify your phone/i });

    verifySelfServiceOtpMock.mockResolvedValue({
      error: { code: "OTP_INCORRECT", message: "That code didn't match. Check the SMS and try again." },
    });
    await enterCode(user, "000000");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    await screen.findByText("That code didn't match. Check the SMS and try again.");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Verify" })).toBeEnabled(),
    );
  });
});

describe("Self-Service Entry — unregistered-phone exit", () => {
  beforeEach(() => {
    requestSelfServiceOtpMock.mockReset();
    verifySelfServiceOtpMock.mockReset();
    requestSelfServiceOtpMock.mockResolvedValue({ requested: true });
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers a way out once the countdown expires, so an unregistered donor is not stranded", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ManagePage />);
    await submitPhone(user);
    await screen.findByRole("heading", { name: /verify your phone/i });

    expect(screen.queryByText(/may not have a verified registration/i)).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(46_000);
    });

    expect(
      await screen.findByText(
        "Didn't get a code? This number may not have a verified registration.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register instead" })).toHaveAttribute(
      "href",
      "/register",
    );
  });
});
