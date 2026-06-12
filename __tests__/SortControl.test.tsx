import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import SortControl from "@/components/filters/SortControl";
import type { ActiveSort, FilterFieldDef } from "@/components/filters/types";

const fields: FilterFieldDef[] = [
  {
    field: "name",
    label: "Name",
    kind: "text",
    source: "standard",
    operators: ["equals", "contains"],
  },
  {
    field: "generation",
    label: "Generation",
    kind: "number",
    source: "standard",
    operators: ["equals", "greater_than"],
  },
  {
    field: "Release Year",
    label: "Release Year",
    kind: "number",
    source: "custom",
    customFieldId: 11,
    operators: ["equals", "greater_than"],
  },
];

const twoLevels: ActiveSort[] = [
  { id: "a", field: "Release Year", label: "Release Year", direction: "desc" },
  { id: "b", field: "name", label: "Name", direction: "asc" },
];

function setup(sorts: ActiveSort[] = [], available: FilterFieldDef[] = fields) {
  const onChange = jest.fn();
  render(<SortControl fields={available} sorts={sorts} onChange={onChange} />);
  return { onChange };
}

function openPopover() {
  fireEvent.click(screen.getByRole("button", { name: "Sort" }));
  return screen.getByRole("dialog", { name: "Sort options" });
}

describe("SortControl", () => {
  it("disables the button when there are no fields", () => {
    setup([], []);
    expect(screen.getByRole("button", { name: "Sort" })).toBeDisabled();
  });

  it("shows the active-level count on the button", () => {
    setup(twoLevels);
    expect(
      within(screen.getByRole("button", { name: "Sort" })).getByText("2"),
    ).toBeInTheDocument();
  });

  it("adds a first level on the first unused field, ascending", () => {
    const { onChange } = setup();
    const dialog = openPopover();
    expect(
      within(dialog).getByText(/Not sorted/, { exact: false }),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Add sort" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ActiveSort[];
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      field: "name",
      label: "Name",
      direction: "asc",
    });
  });

  it("labels levels 'Sort by' then 'then by' in priority order", () => {
    setup(twoLevels);
    const dialog = openPopover();
    expect(within(dialog).getByText("Sort by")).toBeInTheDocument();
    expect(within(dialog).getByText("then by")).toBeInTheDocument();
  });

  it("never offers a field already used by another level", () => {
    setup(twoLevels);
    const dialog = openPopover();

    // Level 2 currently sorts by Name; its picker offers Name (its own) and
    // Generation (unused), but not Release Year (used by level 1).
    fireEvent.click(within(dialog).getByRole("button", { name: "Sort field 2" }));
    const listbox = screen.getByRole("listbox", { name: "Sort field 2" });
    expect(
      within(listbox).getByRole("option", { name: "Name" }),
    ).toBeInTheDocument();
    expect(
      within(listbox).getByRole("option", { name: "Generation" }),
    ).toBeInTheDocument();
    expect(
      within(listbox).queryByRole("option", { name: "Release Year" }),
    ).not.toBeInTheDocument();
  });

  it("changing a level's field updates its label snapshot", () => {
    const { onChange } = setup(twoLevels);
    const dialog = openPopover();

    fireEvent.click(within(dialog).getByRole("button", { name: "Sort field 2" }));
    fireEvent.click(screen.getByRole("option", { name: "Generation" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ActiveSort[];
    expect(next[1]).toMatchObject({
      id: "b",
      field: "generation",
      label: "Generation",
      direction: "asc",
    });
  });

  it("toggles a level's direction", () => {
    const { onChange } = setup(twoLevels);
    const dialog = openPopover();

    const group = within(dialog).getByRole("radiogroup", {
      name: "Sort direction 2",
    });
    expect(within(group).getByRole("radio", { name: "Asc" })).toBeChecked();
    fireEvent.click(within(group).getByRole("radio", { name: "Desc" }));

    const next = onChange.mock.calls[0][0] as ActiveSort[];
    expect(next[1]).toMatchObject({ id: "b", direction: "desc" });
    expect(next[0]).toMatchObject({ id: "a", direction: "desc" });
  });

  it("moves a level up to raise its priority, and pins the ends", () => {
    const { onChange } = setup(twoLevels);
    const dialog = openPopover();

    expect(
      within(dialog).getByRole("button", { name: "Move Release Year sort up" }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Move Name sort down" }),
    ).toBeDisabled();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Move Name sort up" }),
    );

    const next = onChange.mock.calls[0][0] as ActiveSort[];
    expect(next.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("removes a single level", () => {
    const { onChange } = setup(twoLevels);
    const dialog = openPopover();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove Release Year sort" }),
    );

    const next = onChange.mock.calls[0][0] as ActiveSort[];
    expect(next.map((s) => s.id)).toEqual(["b"]);
  });

  it("clears all levels", () => {
    const { onChange } = setup(twoLevels);
    const dialog = openPopover();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Clear sorting" }),
    );
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("disables Add sort when every field is already used", () => {
    setup([
      ...twoLevels,
      { id: "c", field: "generation", label: "Generation", direction: "asc" },
    ]);
    const dialog = openPopover();
    expect(
      within(dialog).getByRole("button", { name: "Add sort" }),
    ).toBeDisabled();
  });

  it("closes on Escape", () => {
    setup(twoLevels);
    openPopover();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Sort options" }),
    ).not.toBeInTheDocument();
  });
});
