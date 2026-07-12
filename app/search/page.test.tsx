import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const submitSearchMock = vi.fn();
const replaceMock = vi.fn();
let searchParamsValue = new URLSearchParams({
  sessionToken: "signed-jwt",
  name: "Zara Ahmed",
});
let matchMediaCoarse = false;
const writeTextMock = vi.fn();

vi.mock("@/app/actions/submitSearch", () => ({
  submitSearch: (...args: unknown[]) => submitSearchMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParamsValue,
}));

beforeEach(() => {
  submitSearchMock.mockReset();
  replaceMock.mockReset();
  searchParamsValue = new URLSearchParams({
    sessionToken: "signed-jwt",
    name: "Zara Ahmed",
  });
  matchMediaCoarse = false;
  writeTextMock.mockReset();

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("coarse") ? matchMediaCoarse : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

import SearchPage from "./page";

async function selectBloodTypeAndArea(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText("Blood type"), "O_NEG");
  await user.click(screen.getByRole("checkbox", { name: "Gulberg" }));
}

// @testing-library/user-event's setup() installs its own clipboard polyfill
// on navigator.clipboard, so the writeText spy must be attached *after*
// userEvent.setup() runs, not in a shared beforeEach.
function setupUserWithClipboardSpy() {
  const user = userEvent.setup();
  vi.spyOn(navigator.clipboard, "writeText").mockImplementation(writeTextMock);
  return user;
}

describe("Search screen", () => {
  it("redirects to /search/verify when sessionToken is missing from the query string", async () => {
    searchParamsValue = new URLSearchParams({ name: "Zara Ahmed" });
    render(<SearchPage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/search/verify"));
  });

  it("keeps Submit disabled until a blood type and area are chosen", async () => {
    const user = userEvent.setup();
    render(<SearchPage />);

    const submit = screen.getByRole("button", { name: "Search" });
    expect(submit).toBeDisabled();

    await selectBloodTypeAndArea(user);

    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("deselects the previously selected area when a new one is chosen (single-select)", async () => {
    const user = userEvent.setup();
    render(<SearchPage />);

    await user.click(screen.getByRole("checkbox", { name: "Gulberg" }));
    expect(screen.getByRole("checkbox", { name: "Gulberg" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await user.click(screen.getByRole("checkbox", { name: "DHA" }));

    expect(screen.getByRole("checkbox", { name: "DHA" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Gulberg" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("shows skeleton rows while the search is pending, then renders match cards", async () => {
    const user = userEvent.setup();
    let resolveSearch: (value: unknown) => void = () => {};
    submitSearchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.getAllByTestId("skeleton-row").length).toBeGreaterThan(0);

    resolveSearch({
      matches: [{ name: "Amara", phone: "+923001111111", area: "Gulberg" }],
    });

    expect(await screen.findByText("Amara")).toBeInTheDocument();
    expect(screen.getByText("+923001111111")).toBeInTheDocument();
    expect(screen.getByText("Gulberg")).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton-row")).not.toBeInTheDocument();
  });

  it("submits with the sessionToken/name from the query string and the chosen bloodType/area", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);

    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() =>
      expect(submitSearchMock).toHaveBeenCalledWith({
        sessionToken: "signed-jwt",
        searcherName: "Zara Ahmed",
        bloodType: "O_NEG",
        area: "Gulberg",
      }),
    );
  });

  it("renders a minimal placeholder when zero matches are returned", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText(/No matches were found/i)).toBeInTheDocument();
  });

  it("shows SESSION_INVALID error with a link back to /search/verify", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({
      error: { code: "SESSION_INVALID", message: "Your session has expired." },
    });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your session has expired.");
    expect(screen.getByRole("link", { name: /verify/i })).toHaveAttribute(
      "href",
      "/search/verify",
    );
  });

  it("clicking the phone link under a coarse (touch) pointer does not copy to clipboard", async () => {
    matchMediaCoarse = true;
    const user = setupUserWithClipboardSpy();
    submitSearchMock.mockResolvedValue({
      matches: [{ name: "Amara", phone: "+923001111111", area: "Gulberg" }],
    });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));
    const phoneLink = await screen.findByRole("link", { name: "+923001111111" });

    await user.click(phoneLink);

    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it("clicking the phone link under a fine (mouse) pointer copies to clipboard and shows Copied", async () => {
    matchMediaCoarse = false;
    const user = setupUserWithClipboardSpy();
    submitSearchMock.mockResolvedValue({
      matches: [{ name: "Amara", phone: "+923001111111", area: "Gulberg" }],
    });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));
    const phoneLink = await screen.findByRole("link", { name: "+923001111111" });

    await user.click(phoneLink);

    expect(writeTextMock).toHaveBeenCalledWith("+923001111111");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });
});
