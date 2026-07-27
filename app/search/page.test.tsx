import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const submitSearchMock = vi.fn();
const expandSearchMock = vi.fn();
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

vi.mock("@/app/actions/expandSearch", () => ({
  expandSearch: (...args: unknown[]) => expandSearchMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParamsValue,
}));

beforeEach(() => {
  submitSearchMock.mockReset();
  expandSearchMock.mockReset();
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

  it("routes a zero-match search to the Area Expansion Prompt, not the old placeholder", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText(/couldn't find a match in Gulberg/i)).toBeInTheDocument();
    expect(screen.queryByText(/No matches were found in this area yet/i)).not.toBeInTheDocument();
  });

  it("names the specific nearby areas that would be searched", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));

    const prompt = await screen.findByText(/We can also check nearby areas/i);
    for (const label of ["Model Town", "Cantt", "Garden Town", "DHA"]) {
      expect(prompt).toHaveTextContent(label);
    }
  });

  it("confirms expansion with the originally-searched area and shows skeletons while pending", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    let resolveExpand: (value: unknown) => void = () => {};
    expandSearchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveExpand = resolve;
      }),
    );
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByRole("button", { name: "Search nearby areas" }));

    expect(expandSearchMock).toHaveBeenCalledWith({
      sessionToken: "signed-jwt",
      searcherName: "Zara Ahmed",
      bloodType: "O_NEG",
      originArea: "Gulberg",
    });
    expect(screen.getAllByTestId("skeleton-row").length).toBeGreaterThan(0);

    resolveExpand({ matches: [], areasSearched: ["ModelTown"] });
    await waitFor(() =>
      expect(screen.queryByTestId("skeleton-row")).not.toBeInTheDocument(),
    );
  });

  it("renders expansion matches as cards, naming the areas that produced results", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    expandSearchMock.mockResolvedValue({
      matches: [
        { name: "Amara", phone: "+923001111111", area: "ModelTown" },
        { name: "Cyra", phone: "+923003333333", area: "Cantt" },
      ],
      areasSearched: ["ModelTown", "Cantt", "GardenTown", "DHA"],
    });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByRole("button", { name: "Search nearby areas" }));

    expect(await screen.findByText("Amara")).toBeInTheDocument();
    expect(screen.getByText("Cyra")).toBeInTheDocument();

    const summary = screen.getByTestId("matched-areas-summary");
    expect(summary).toHaveTextContent("Model Town");
    expect(summary).toHaveTextContent("Cantt");
    expect(summary).not.toHaveTextContent("Garden Town");
  });

  it("names every area that produced a match, including areas a deduped donor also matched in", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    expandSearchMock.mockResolvedValue({
      // Amara is registered in both Model Town and Cantt; dedup keeps Model Town as her primary
      // area, so a summary built from `area` alone would wrongly report Cantt as empty.
      matches: [
        {
          name: "Amara",
          phone: "+923001111111",
          area: "ModelTown",
          matchedAreas: ["ModelTown", "Cantt"],
        },
      ],
      areasSearched: ["ModelTown", "Cantt", "GardenTown", "DHA"],
    });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByRole("button", { name: "Search nearby areas" }));

    const summary = await screen.findByTestId("matched-areas-summary");
    expect(summary).toHaveTextContent("Model Town");
    expect(summary).toHaveTextContent("Cantt");
    expect(summary).not.toHaveTextContent("Garden Town");

    expect(screen.getByText("Model Town, Cantt")).toBeInTheDocument();
  });

  it("does not show the matched-areas summary after a first-pass search", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({
      matches: [{ name: "Amara", phone: "+923001111111", area: "Gulberg" }],
    });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Amara")).toBeInTheDocument();
    expect(screen.queryByTestId("matched-areas-summary")).not.toBeInTheDocument();
  });

  it("lands on the Empty State when the expansion also finds nothing, with no leftover stopgap", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    expandSearchMock.mockResolvedValue({ matches: [], areasSearched: ["ModelTown"] });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByRole("button", { name: "Search nearby areas" }));

    expect(await screen.findByRole("heading", { level: 1, name: /no match found/i })).toBeInTheDocument();
    expect(
      screen.queryByText(/couldn't find a match in nearby areas either/i),
    ).not.toBeInTheDocument();
  });

  it("names the areas the expansion actually searched on the Empty State", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    expandSearchMock.mockResolvedValue({
      matches: [],
      areasSearched: ["ModelTown", "Cantt"],
    });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByRole("button", { name: "Search nearby areas" }));

    // Pin the whole sentence, not just the substrings: label-presence assertions pass on any
    // word order, which is how a run-on with two conjunctions shipped green once already.
    const body = await screen.findByTestId("empty-state-body");
    expect(body.textContent).toBe(
      "We checked Gulberg, Model Town and Cantt, and no eligible donor is listed for O- right now.",
    );
  });

  it("reads as one grammatical list for a realistic multi-area expansion", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    expandSearchMock.mockResolvedValue({
      matches: [],
      areasSearched: ["ModelTown", "Cantt", "GardenTown", "DHA"],
    });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByRole("button", { name: "Search nearby areas" }));

    const body = await screen.findByTestId("empty-state-body");
    expect(body.textContent).toBe(
      "We checked Gulberg, Model Town, Cantt, Garden Town and DHA, " +
        "and no eligible donor is listed for O- right now.",
    );
    // Exactly one conjunction inside the area list.
    expect(body.textContent?.match(/ and /g)).toHaveLength(2);
  });

  it("offers exactly one next-step link on the Empty State, pointing at /search/verify", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    expandSearchMock.mockResolvedValue({ matches: [], areasSearched: ["ModelTown"] });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByRole("button", { name: "Search nearby areas" }));

    await screen.findByRole("heading", { level: 1, name: /no match found/i });

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/search/verify");
    // The only way forward on a dead-end screen: underlined at rest (not colour-only, WCAG 1.4.1)
    // and meeting the >=44px tap-target floor.
    expect(links[0].className).toMatch(/\bunderline\b/);
    expect(links[0].className).toMatch(/min-h-\[44px\]/);
  });

  it("renders no match cards and no matched-areas summary on the Empty State", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    expandSearchMock.mockResolvedValue({ matches: [], areasSearched: ["ModelTown"] });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByRole("button", { name: "Search nearby areas" }));

    await screen.findByRole("heading", { level: 1, name: /no match found/i });

    expect(screen.queryByTestId("matched-areas-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("skeleton-row")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^\+92/ })).not.toBeInTheDocument();
  });

  it("renders a well-formed Empty State sentence when no nearby areas were searched", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    expandSearchMock.mockResolvedValue({ matches: [], areasSearched: [] });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByRole("button", { name: "Search nearby areas" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: /no match found/i }),
    ).toBeInTheDocument();

    const body = screen.getByTestId("empty-state-body");
    expect(body.textContent).toBe(
      "We checked Gulberg, and no eligible donor is listed for O- right now.",
    );
  });

  it("routes a zero-match first-pass search to the expansion prompt, never straight to the Empty State", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(
      await screen.findByRole("button", { name: "Search nearby areas" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /no match found/i })).not.toBeInTheDocument();
  });

  it("shows SESSION_EXHAUSTED from an expansion with a link back to /search/verify", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    expandSearchMock.mockResolvedValue({
      error: { code: "SESSION_EXHAUSTED", message: "This search session has been used up." },
    });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByRole("button", { name: "Search nearby areas" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This search session has been used up.",
    );
    expect(screen.getByRole("link", { name: /verify/i })).toHaveAttribute(
      "href",
      "/search/verify",
    );
  });

  it("surfaces a recoverable message when the search action rejects outright", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockRejectedValue(new Error("connection lost"));
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByTestId("skeleton-row")).not.toBeInTheDocument();
  });

  it("surfaces a recoverable message when the expansion action rejects outright", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    expandSearchMock.mockRejectedValue(new Error("connection lost"));
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(await screen.findByRole("button", { name: "Search nearby areas" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
  });

  it("disables the expand button after a terminal SESSION_EXHAUSTED, so re-clicks cannot burn rate-limit slots", async () => {
    const user = userEvent.setup();
    submitSearchMock.mockResolvedValue({ matches: [] });
    expandSearchMock.mockResolvedValue({
      error: { code: "SESSION_EXHAUSTED", message: "This search session has been used up." },
    });
    render(<SearchPage />);
    await selectBloodTypeAndArea(user);
    await user.click(screen.getByRole("button", { name: "Search" }));
    const expandButton = await screen.findByRole("button", { name: "Search nearby areas" });
    await user.click(expandButton);

    await screen.findByRole("alert");
    expect(expandButton).toBeDisabled();

    expandSearchMock.mockClear();
    await user.click(expandButton);
    expect(expandSearchMock).not.toHaveBeenCalled();
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
