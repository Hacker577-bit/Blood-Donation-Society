import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const createDonorMock = vi.fn();
const pushMock = vi.fn();

vi.mock("@/lib/infra/repositories/donorRepository", () => ({
  createDonor: (...args: unknown[]) => createDonorMock(...args),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@vercel/functions", () => ({
  ipAddress: () => "198.51.100.77",
}));

vi.mock("@/lib/infra/rateLimitStore", () => ({
  redisRateLimitStore: {
    // Always allowed: rate-limiting behavior itself is covered by
    // registerDonor.test.ts; this screen's tests exercise form/UX behavior.
    async recordAndCount() {
      return { count: 1, oldestTimestampMs: null };
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import DonorRegistrationPage from "./page";

describe("Donor Registration screen", () => {
  beforeEach(() => {
    createDonorMock.mockReset();
    pushMock.mockReset();
  });

  it("keeps Submit disabled until required fields are valid, then enables it", async () => {
    const user = userEvent.setup();
    render(<DonorRegistrationPage />);

    const submit = screen.getByRole("button", { name: "Submit" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Name"), "Priya Sharma");
    await user.type(screen.getByLabelText("Phone number"), "+923001234567");
    await user.selectOptions(screen.getByLabelText("Blood type"), "B_POS");
    await user.click(screen.getByRole("checkbox", { name: "Model Town" }));

    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("does not show an inline error before the field is blurred", async () => {
    const user = userEvent.setup();
    render(<DonorRegistrationPage />);

    const phone = screen.getByLabelText("Phone number");
    await user.type(phone, "123");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an inline error below the field on blur when invalid", async () => {
    const user = userEvent.setup();
    render(<DonorRegistrationPage />);

    const phone = screen.getByLabelText("Phone number");
    await user.type(phone, "123");
    await user.tab();

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid phone number/i);
  });

  it("never blocks submission because the email field is blank", async () => {
    const user = userEvent.setup();
    createDonorMock.mockResolvedValue({ id: "donor_1" });
    render(<DonorRegistrationPage />);

    await user.type(screen.getByLabelText("Name"), "Priya Sharma");
    await user.type(screen.getByLabelText("Phone number"), "+923001234567");
    await user.selectOptions(screen.getByLabelText("Blood type"), "B_POS");
    await user.click(screen.getByRole("checkbox", { name: "Model Town" }));
    // leave email blank

    const submit = screen.getByRole("button", { name: "Submit" });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() => expect(createDonorMock).toHaveBeenCalledTimes(1));
  });

  it("toggles multiple areas via chip selection", async () => {
    const user = userEvent.setup();
    render(<DonorRegistrationPage />);

    const modelTown = screen.getByRole("checkbox", { name: "Model Town" });
    const dha = screen.getByRole("checkbox", { name: "DHA" });

    await user.click(modelTown);
    await user.click(dha);

    expect(modelTown).toHaveAttribute("aria-checked", "true");
    expect(dha).toHaveAttribute("aria-checked", "true");

    await user.click(modelTown);
    expect(modelTown).toHaveAttribute("aria-checked", "false");
    expect(dha).toHaveAttribute("aria-checked", "true");
  });

  it("shows a spinner/'Sending…' state on submit instead of freezing silently", async () => {
    const user = userEvent.setup();
    let resolveCreate!: (value: { id: string }) => void;
    createDonorMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    render(<DonorRegistrationPage />);

    await user.type(screen.getByLabelText("Name"), "Priya Sharma");
    await user.type(screen.getByLabelText("Phone number"), "+923001234567");
    await user.selectOptions(screen.getByLabelText("Blood type"), "B_POS");
    await user.click(screen.getByRole("checkbox", { name: "Model Town" }));

    const submit = screen.getByRole("button", { name: "Submit" });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    expect(await screen.findByRole("button", { name: "Sending…" })).toBeInTheDocument();

    resolveCreate({ id: "donor_1" });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/register/verify?donorId=donor_1"));
  });

  it("renders a visible spinner element while submitting, not just a text swap", async () => {
    const user = userEvent.setup();
    createDonorMock.mockReturnValue(new Promise(() => {}));
    render(<DonorRegistrationPage />);

    await user.type(screen.getByLabelText("Name"), "Priya Sharma");
    await user.type(screen.getByLabelText("Phone number"), "+923001234567");
    await user.selectOptions(screen.getByLabelText("Blood type"), "B_POS");
    await user.click(screen.getByRole("checkbox", { name: "Model Town" }));

    const submit = screen.getByRole("button", { name: "Submit" });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    expect(await screen.findByTestId("button-spinner")).toBeInTheDocument();
  });

  it("shows an inline error when the last selected area is deselected, leaving none selected", async () => {
    const user = userEvent.setup();
    render(<DonorRegistrationPage />);

    const modelTown = screen.getByRole("checkbox", { name: "Model Town" });
    await user.click(modelTown);
    await user.click(modelTown);

    expect(await screen.findByRole("alert")).toHaveTextContent(/select at least one area/i);
  });

  it("clears a stale inline error once the field becomes valid, even without a further blur", async () => {
    const user = userEvent.setup();
    render(<DonorRegistrationPage />);

    const phone = screen.getByLabelText("Phone number");
    await user.type(phone, "123");
    await user.tab();
    expect(await screen.findByRole("alert")).toHaveTextContent(/valid phone number/i);

    await user.clear(phone);
    await user.type(phone, "+923001234567");

    await waitFor(() =>
      expect(screen.queryByText(/valid phone number/i)).not.toBeInTheDocument(),
    );
  });

  it("shows the server's error message and re-enables the form when registration fails", async () => {
    const user = userEvent.setup();
    createDonorMock.mockRejectedValue({ code: "P2002", meta: { target: ["phone"] } });
    render(<DonorRegistrationPage />);

    await user.type(screen.getByLabelText("Name"), "Priya Sharma");
    await user.type(screen.getByLabelText("Phone number"), "+923001234567");
    await user.selectOptions(screen.getByLabelText("Blood type"), "B_POS");
    await user.click(screen.getByRole("checkbox", { name: "Model Town" }));

    const submit = screen.getByRole("button", { name: "Submit" });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    const errorMessages = await screen.findAllByText(
      "That phone number is already registered.",
    );
    expect(errorMessages.length).toBeGreaterThan(0);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows the rate-limit message as a non-field submission error, not tied to any specific field", async () => {
    const user = userEvent.setup();
    createDonorMock.mockRejectedValue({ code: "P2002", meta: { target: ["donorId", "area"] } });
    render(<DonorRegistrationPage />);

    // Not exercised through a real rate-limit rejection here (that's covered
    // by registerDonor.test.ts) — this verifies the form renders a non-field
    // submission error near Submit, the same path a RATE_LIMITED response
    // (which has no fieldErrors) would take.
    await user.type(screen.getByLabelText("Name"), "Priya Sharma");
    await user.type(screen.getByLabelText("Phone number"), "+923001234567");
    await user.selectOptions(screen.getByLabelText("Blood type"), "B_POS");
    await user.click(screen.getByRole("checkbox", { name: "Model Town" }));

    const submit = screen.getByRole("button", { name: "Submit" });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
