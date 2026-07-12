import { describe, expect, it, vi, beforeEach } from "vitest";

const searchCreateMock = vi.fn();

vi.mock("@/lib/infra/prisma", () => ({
  prisma: {
    search: {
      create: (...args: unknown[]) => searchCreateMock(...args),
    },
  },
}));

import { createSearch } from "./searchRepository";

describe("searchRepository.createSearch", () => {
  beforeEach(() => {
    searchCreateMock.mockReset();
  });

  it("writes the Search record with the given fields and returns its id", async () => {
    searchCreateMock.mockResolvedValue({ id: "search_1" });

    const result = await createSearch({
      searcherName: "Zara",
      searcherPhone: "+923009999999",
      bloodType: "O_NEG",
      area: "Gulberg",
    });

    expect(result).toEqual({ id: "search_1" });
    expect(searchCreateMock).toHaveBeenCalledWith({
      data: {
        searcherName: "Zara",
        searcherPhone: "+923009999999",
        bloodType: "O_NEG",
        area: "Gulberg",
      },
      select: { id: true },
    });
  });
});
