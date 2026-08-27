import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import SavedFilterCard from "@/components/home/SavedFilterCard";
import type { SavedFilter } from "@/components/home/types";

// The card fetches its live match count on mount. These tests are about the
// link and the sort pills, so the request is left pending (the count simply
// stays "—") rather than resolving into a state update outside act().
beforeEach(() => {
  global.fetch = jest.fn(
    () => new Promise<Response>(() => {}),
  ) as unknown as typeof fetch;
});

function savedFilter(overrides: Partial<SavedFilter> = {}): SavedFilter {
  return {
    id: "f1",
    name: "Boxed toys",
    entity: "toy",
    conditions: [
      {
        id: "c1",
        field: "name",
        label: "Name",
        kind: "text",
        source: "standard",
        operator: "contains",
        operand: "R2",
      },
    ],
    sorts: [],
    ...overrides,
  };
}

// The decoded `sorts` param of the card's link, or null when it carries none.
function sortsParam(): unknown {
  const href = screen.getByRole("link", { name: "Boxed toys" }).getAttribute("href")!;
  const raw = new URL(href, "http://localhost").searchParams.get("sorts");
  return raw == null ? null : JSON.parse(raw);
}

describe("SavedFilterCard sorting", () => {
  it("carries the saved sort levels in the link, in priority order", () => {
    render(
      <SavedFilterCard
        filter={savedFilter({
          sorts: [
            { id: "s1", field: "name", label: "Name", direction: "asc" },
            { id: "s2", field: "set", label: "Set", direction: "desc" },
          ],
        })}
      />,
    );

    expect(sortsParam()).toEqual([
      { field: "name", label: "Name", direction: "asc" },
      { field: "set", label: "Set", direction: "desc" },
    ]);
  });

  it("omits the param when the filter saved no sorting", () => {
    render(<SavedFilterCard filter={savedFilter()} />);
    expect(sortsParam()).toBeNull();
  });

  it("shows each sort level and its direction", () => {
    render(
      <SavedFilterCard
        filter={savedFilter({
          sorts: [
            { id: "s1", field: "name", label: "Name", direction: "asc" },
            { id: "s2", field: "set", label: "Set", direction: "desc" },
          ],
        })}
      />,
    );

    expect(screen.getByLabelText("Name ascending")).toBeInTheDocument();
    expect(screen.getByLabelText("Set descending")).toBeInTheDocument();
  });

  it("says nothing about sorting when there is none", () => {
    render(<SavedFilterCard filter={savedFilter()} />);
    expect(screen.queryByText("Sorted by")).not.toBeInTheDocument();
  });
});
