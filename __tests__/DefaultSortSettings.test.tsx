import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DefaultSortSettings from "@/components/DefaultSortSettings";
import { EMPTY_DEFAULT_SORT_OPTIONS } from "@/lib/defaultSortOptions.types";

// Mirrors the real /filters/system response shape, including the all_fields
// sort capability marker.
const FILTER_SPEC = {
  type: "system_filters",
  fields: {
    name: "text",
    generation: "number",
    all_fields: "sort",
    pagination_fields: "pagination",
  },
  filters: {
    name: ["equals", "contains"],
    generation: ["equals", "greater_than", "less_than"],
    all_fields: ["order_by", "order_by_desc"],
    pagination_fields: ["limit", "offset"],
  },
};

type FetchMock = jest.Mock<
  Promise<{ ok: boolean; json: () => Promise<unknown> }>,
  [input: string, init?: RequestInit]
>;

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

// Routes the component's fetches by URL: the stored defaults, the filter spec
// and (empty) custom fields for every entity, and the POST write. POST bodies
// are collected for assertions.
function mockFetch(stored: unknown, posts: unknown[]): FetchMock {
  return jest.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/default-sort-options")) {
      if (init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)));
        return jsonResponse({ ok: true });
      }
      return jsonResponse(stored);
    }
    if (url.includes("/api/filters/")) {
      return jsonResponse({ status: "ok", data: FILTER_SPEC });
    }
    if (url.includes("/api/custom-fields/entity/")) {
      return jsonResponse({ status: "ok", data: [] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

describe("DefaultSortSettings", () => {
  const posts: unknown[] = [];

  beforeEach(() => {
    posts.length = 0;
  });

  afterEach(() => {
    // @ts-expect-error - cleanup of the per-test fetch stub
    delete global.fetch;
  });

  function renderWithDefaults(stored: unknown) {
    global.fetch = mockFetch(stored, posts) as unknown as typeof fetch;
    return render(<DefaultSortSettings />);
  }

  it("renders a Sort button per entity, games first then toys and systems", async () => {
    renderWithDefaults(EMPTY_DEFAULT_SORT_OPTIONS);

    expect(
      screen.getByRole("heading", { level: 2, name: "Default Sort Options" }),
    ).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: /^Default sort for/ });
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Default sort for Video Games",
      "Default sort for Video Game Boxes",
      "Default sort for Board Games",
      "Default sort for Board Game Boxes",
      "Default sort for Toys",
      "Default sort for Systems",
    ]);
    // Enabled once each entity's field list loads.
    for (const button of buttons) {
      await waitFor(() => expect(button).toBeEnabled());
    }
  });

  it("shows the stored default levels in the sort popover", async () => {
    renderWithDefaults({
      ...EMPTY_DEFAULT_SORT_OPTIONS,
      system: [{ field: "generation", direction: "desc" }],
    });

    const button = screen.getByRole("button", {
      name: "Default sort for Systems",
    });
    await waitFor(() => expect(button).toBeEnabled());
    // The active-level count bubble reflects the stored default.
    expect(button).toHaveTextContent("1");

    fireEvent.click(button);
    const dialog = screen.getByRole("dialog", {
      name: "Default sort for Systems options",
    });
    expect(dialog).toHaveTextContent("Sort by");
    expect(
      screen.getByRole("radio", { name: "Desc" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("persists an added level and commits it once the write succeeds", async () => {
    renderWithDefaults(EMPTY_DEFAULT_SORT_OPTIONS);

    const button = screen.getByRole("button", {
      name: "Default sort for Systems",
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Add sort" }));

    // The write carries the full record with the new system level (the first
    // unused field, ascending).
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      ...EMPTY_DEFAULT_SORT_OPTIONS,
      system: [{ field: "name", direction: "asc" }],
    });
    // Confirmed write: the level is now reflected in the control.
    await waitFor(() => expect(button).toHaveTextContent("1"));
  });

  it("keeps the last known-good defaults when the write fails", async () => {
    global.fetch = jest.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/default-sort-options")) {
        if (init?.method === "POST") {
          return { ok: false, json: async () => ({ ok: false }) };
        }
        return jsonResponse(EMPTY_DEFAULT_SORT_OPTIONS);
      }
      if (url.includes("/api/filters/")) {
        return jsonResponse({ status: "ok", data: FILTER_SPEC });
      }
      if (url.includes("/api/custom-fields/entity/")) {
        return jsonResponse({ status: "ok", data: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;
    render(<DefaultSortSettings />);

    const button = screen.getByRole("button", {
      name: "Default sort for Systems",
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Add sort" }));

    // The rejected write leaves the stored (empty) defaults showing.
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/default-sort-options",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(button).not.toHaveTextContent("1");
  });
});
