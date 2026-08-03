import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const isAdminAuthenticatedMock = vi.fn();
const listAllDonorsMock = vi.fn();
const adminLoginMock = vi.fn();
const adminAddDonorMock = vi.fn();
const adminDeleteDonorMock = vi.fn();
const adminLogoutMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("@/lib/admin-auth", () => ({
  isAdminAuthenticated: (...args: unknown[]) => isAdminAuthenticatedMock(...args),
}));

vi.mock("@/lib/infra/repositories/donorRepository", () => ({
  listAllDonors: (...args: unknown[]) => listAllDonorsMock(...args),
}));

vi.mock("@/app/actions/admin", () => ({
  adminLogin: (...args: unknown[]) => adminLoginMock(...args),
  adminAddDonor: (...args: unknown[]) => adminAddDonorMock(...args),
  adminDeleteDonor: (...args: unknown[]) => adminDeleteDonorMock(...args),
  adminLogout: (...args: unknown[]) => adminLogoutMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import AdminPage from "./page";

const DONORS = [
  {
    id: "donor_1",
    name: "Priya Sharma",
    phone: "+923001234567",
    email: "priya@example.com",
    bloodType: "B_POS",
    lastDonationDate: null,
    isVerified: true,
    areas: ["ModelTown", "IqbalTown"],
  },
  {
    id: "donor_2",
    name: "Ahmed Khan",
    phone: "+923112345678",
    email: null,
    bloodType: "O_NEG",
    lastDonationDate: "2024-12-01T00:00:00.000Z",
    isVerified: true,
    areas: ["DHA"],
  },
];

describe("Admin page", () => {
  beforeEach(() => {
    isAdminAuthenticatedMock.mockReset();
    listAllDonorsMock.mockReset();
    adminLoginMock.mockReset();
    adminAddDonorMock.mockReset();
    adminDeleteDonorMock.mockReset();
    adminLogoutMock.mockReset();
    refreshMock.mockReset();
  });

  it("shows the password sign-in form when not authenticated", async () => {
    isAdminAuthenticatedMock.mockResolvedValue(false);

    render(await AdminPage());

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Admin");
    expect(screen.getByLabelText("Admin password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(listAllDonorsMock).not.toHaveBeenCalled();
  });

  it("signs in with the correct password and refreshes", async () => {
    isAdminAuthenticatedMock.mockResolvedValue(false);
    adminLoginMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    render(await AdminPage());

    await user.type(screen.getByLabelText("Admin password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(adminLoginMock).toHaveBeenCalledWith("correct-horse"));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("shows an inline error for an incorrect password", async () => {
    isAdminAuthenticatedMock.mockResolvedValue(false);
    adminLoginMock.mockResolvedValue({ ok: false, error: "Incorrect password." });
    const user = userEvent.setup();

    render(await AdminPage());

    await user.type(screen.getByLabelText("Admin password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect password.");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renders the donor list when authenticated", async () => {
    isAdminAuthenticatedMock.mockResolvedValue(true);
    listAllDonorsMock.mockResolvedValue(DONORS);

    render(await AdminPage());

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Donor management",
    );
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("Ahmed Khan")).toBeInTheDocument();
    expect(screen.getByText("+923001234567 · priya@example.com")).toBeInTheDocument();
    expect(screen.getByText("2 donors on file.")).toBeInTheDocument();

    const list = screen.getByRole("region", { name: "All donors" });
    expect(within(list).getAllByText("B+").length).toBeGreaterThan(0);
    expect(within(list).getAllByText("O-").length).toBeGreaterThan(0);
  });

  it("shows the add-donor form when authenticated", async () => {
    isAdminAuthenticatedMock.mockResolvedValue(true);
    listAllDonorsMock.mockResolvedValue([]);

    render(await AdminPage());

    expect(screen.getByRole("heading", { name: "Add a donor" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
    expect(screen.getByLabelText("Blood type")).toBeInTheDocument();
    expect(screen.getByText("No donors yet.")).toBeInTheDocument();
  });

  it("submits a valid donor and refreshes the list", async () => {
    isAdminAuthenticatedMock.mockResolvedValue(true);
    listAllDonorsMock.mockResolvedValue([]);
    adminAddDonorMock.mockResolvedValue({ ok: true, donorId: "donor_new" });
    const user = userEvent.setup();

    render(await AdminPage());

    await user.type(screen.getByLabelText("Name"), "Sara Ali");
    await user.type(screen.getByLabelText("Phone number"), "+923334455667");
    await user.selectOptions(screen.getByLabelText("Blood type"), "A_POS");
    await user.click(screen.getByRole("checkbox", { name: "Johar Town" }));

    const submit = screen.getByRole("button", { name: "Add donor" });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() =>
      expect(adminAddDonorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Sara Ali",
          phone: "+923334455667",
          bloodType: "A_POS",
          areas: ["JoharTown"],
        }),
      ),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(await screen.findByText("Donor added.")).toBeInTheDocument();
  });

  it("surfaces the server's phone-duplicate error without refreshing", async () => {
    isAdminAuthenticatedMock.mockResolvedValue(true);
    listAllDonorsMock.mockResolvedValue([]);
    adminAddDonorMock.mockResolvedValue({
      ok: false,
      error: "That phone number is already registered.",
      fieldErrors: { phone: "That phone number is already registered." },
    });
    const user = userEvent.setup();

    render(await AdminPage());

    await user.type(screen.getByLabelText("Name"), "Sara Ali");
    await user.type(screen.getByLabelText("Phone number"), "+923001234567");
    await user.selectOptions(screen.getByLabelText("Blood type"), "A_POS");
    await user.click(screen.getByRole("checkbox", { name: "Johar Town" }));

    const submit = screen.getByRole("button", { name: "Add donor" });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    const errorMessages = await screen.findAllByText(
      "That phone number is already registered.",
    );
    expect(errorMessages.length).toBeGreaterThan(0);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("deletes a donor after confirmation", async () => {
    isAdminAuthenticatedMock.mockResolvedValue(true);
    listAllDonorsMock.mockResolvedValue(DONORS);
    adminDeleteDonorMock.mockResolvedValue({ ok: true });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(await AdminPage());

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    await waitFor(() => expect(adminDeleteDonorMock).toHaveBeenCalledWith("donor_1"));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());

    confirmSpy.mockRestore();
  });

  it("skips deletion when the admin cancels the confirmation", async () => {
    isAdminAuthenticatedMock.mockResolvedValue(true);
    listAllDonorsMock.mockResolvedValue(DONORS);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();

    render(await AdminPage());

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    expect(adminDeleteDonorMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("logs out and refreshes back to the login gate", async () => {
    isAdminAuthenticatedMock.mockResolvedValue(true);
    listAllDonorsMock.mockResolvedValue(DONORS);
    adminLogoutMock.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(await AdminPage());

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(adminLogoutMock).toHaveBeenCalled());
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});
