import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import FilterBar from "@/components/filters/FilterBar";
import type { ActiveFilter, FilterFieldDef } from "@/components/filters/types";

const fields: FilterFieldDef[] = [
  {
    field: "name",
    label: "Name",
    kind: "text",
    source: "standard",
    operators: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
  },
  {
    field: "Year",
    label: "Year",
    kind: "number",
    source: "custom",
    customFieldId: 11,
    operators: [
      "equals",
      "not_equals",
      "greater_than",
      "less_than",
      "greater_than_equal_to",
      "less_than_equal_to",
    ],
  },
  {
    field: "Series",
    label: "Series",
    kind: "dropdown",
    source: "custom",
    customFieldId: 12,
    operators: ["equals", "not_equals"],
    options: [
      { id: 21, customFieldId: 12, name: "Original", isDefault: true, order: 0 },
      { id: 22, customFieldId: 12, name: "Special", isDefault: false, order: 1 },
    ],
  },
];

function setup(filters: ActiveFilter[] = []) {
  const onChange = jest.fn();
  const onSearchChange = jest.fn();
  render(
    <FilterBar
      entityKey="toy"
      fields={fields}
      filters={filters}
      onChange={onChange}
      searchValue=""
      onSearchChange={onSearchChange}
      searchPlaceholder="Search toys…"
      searchAriaLabel="Search toys"
    />,
  );
  return { onChange, onSearchChange };
}

describe("FilterBar", () => {
  it("renders a chip per active filter with edit + remove controls", () => {
    setup([
      {
        id: "a",
        field: "name",
        label: "Name",
        kind: "text",
        operator: "contains",
        operand: "Mario",
      },
    ]);

    expect(
      screen.getByRole("button", { name: "Edit Name filter" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Name filter" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mario")).toBeInTheDocument();
    expect(screen.getByText("contains")).toBeInTheDocument();
  });

  it("forwards search-box typing to onSearchChange", () => {
    const { onSearchChange } = setup();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search toys" }), {
      target: { value: "pika" },
    });
    expect(onSearchChange).toHaveBeenCalledWith("pika");
  });

  it("turns the search text into a name-contains chip and clears the box on Enter", () => {
    const onChange = jest.fn();
    const onSearchChange = jest.fn();
    render(
      <FilterBar
        entityKey="toy"
        fields={fields}
        filters={[]}
        onChange={onChange}
        searchValue="mario"
        onSearchChange={onSearchChange}
        searchAriaLabel="Search toys"
      />,
    );

    fireEvent.keyDown(screen.getByRole("searchbox", { name: "Search toys" }), {
      key: "Enter",
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ActiveFilter[];
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      field: "name",
      operator: "contains",
      operand: "mario",
    });
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("ignores Enter when the search box is empty", () => {
    const onChange = jest.fn();
    render(
      <FilterBar
        entityKey="toy"
        fields={fields}
        filters={[]}
        onChange={onChange}
        searchValue="   "
        onSearchChange={jest.fn()}
        searchAriaLabel="Search toys"
      />,
    );
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "Search toys" }), {
      key: "Enter",
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("adds a filter through the editor", () => {
    const { onChange } = setup();

    // Empty state shows a "Filter" button that opens the add editor.
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    expect(screen.getByRole("dialog", { name: "Add filter" })).toBeInTheDocument();

    // Defaults to the first field (Name) + its first operator (is). Type a value.
    fireEvent.change(screen.getByRole("textbox", { name: "Name value" }), {
      target: { value: "Mario" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ActiveFilter[];
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      field: "name",
      operator: "equals",
      operand: "Mario",
    });
  });

  it("offers operators matching the chosen field's kind", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));

    // Switch the field to the numeric Year field.
    fireEvent.click(screen.getByRole("button", { name: "Filter field" }));
    fireEvent.click(screen.getByRole("option", { name: "Year" }));

    // Its operator list includes the numeric comparisons.
    fireEvent.click(screen.getByRole("button", { name: "Filter operator" }));
    const listbox = screen.getByRole("listbox", { name: "Filter operator" });
    expect(within(listbox).getByRole("option", { name: "≥" })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: "<" })).toBeInTheDocument();
    expect(
      within(listbox).queryByRole("option", { name: "contains" }),
    ).not.toBeInTheDocument();
  });

  it("edits an existing filter and replaces it by id", () => {
    const { onChange } = setup([
      {
        id: "a",
        field: "Series",
        label: "Series",
        kind: "dropdown",
        operator: "equals",
        operand: "Original",
        options: fields[2].options,
      },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Edit Series filter" }));
    expect(
      screen.getByRole("dialog", { name: "Edit filter" }),
    ).toBeInTheDocument();

    // Change the selected option to "Special" via the value listbox.
    fireEvent.click(screen.getByRole("button", { name: "Series value" }));
    fireEvent.click(screen.getByRole("option", { name: "Special" }));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ActiveFilter[];
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: "a", operand: "Special" });
  });

  describe("system fields with valueOptions", () => {
    const systemField: FilterFieldDef = {
      field: "system_id",
      label: "System",
      kind: "system",
      source: "standard",
      operators: ["equals", "not_equals"],
      valueOptions: [
        { value: "1", label: "NES" },
        { value: "2", label: "SNES" },
      ],
    };

    function setupSystem(filters: ActiveFilter[] = []) {
      const onChange = jest.fn();
      render(
        <FilterBar
          entityKey="videoGame"
          fields={[...fields, systemField]}
          filters={filters}
          onChange={onChange}
          searchValue=""
          onSearchChange={jest.fn()}
          searchAriaLabel="Search video games"
        />,
      );
      return { onChange };
    }

    it("offers a listbox of labels and applies the value with its label snapshot", () => {
      const { onChange } = setupSystem();
      fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
      fireEvent.click(screen.getByRole("button", { name: "Filter field" }));
      fireEvent.click(screen.getByRole("option", { name: "System" }));

      // The value control is a listbox of system names, defaulting to the first.
      fireEvent.click(screen.getByRole("button", { name: "System value" }));
      fireEvent.click(screen.getByRole("option", { name: "SNES" }));
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const next = onChange.mock.calls[0][0] as ActiveFilter[];
      expect(next).toHaveLength(1);
      expect(next[0]).toMatchObject({
        field: "system_id",
        operator: "equals",
        operand: "2",
        operandLabel: "SNES",
      });
    });

    it("shows the operand label on the chip instead of the raw id", () => {
      setupSystem([
        {
          id: "a",
          field: "system_id",
          label: "System",
          kind: "system",
          operator: "equals",
          operand: "1",
          operandLabel: "NES",
        },
      ]);
      const chip = screen.getByRole("button", { name: "Edit System filter" });
      expect(within(chip).getByText("NES")).toBeInTheDocument();
      expect(within(chip).queryByText("1")).not.toBeInTheDocument();
    });

    it("falls back to a number input for a system field without valueOptions", () => {
      const onChange = jest.fn();
      render(
        <FilterBar
          entityKey="videoGame"
          fields={[{ ...systemField, valueOptions: undefined }]}
          filters={[]}
          onChange={onChange}
          searchValue=""
          onSearchChange={jest.fn()}
          searchAriaLabel="Search video games"
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
      expect(
        screen.getByRole("spinbutton", { name: "System value" }),
      ).toBeInTheDocument();
    });
  });

  it("removes a filter via its ✕", () => {
    const { onChange } = setup([
      {
        id: "a",
        field: "name",
        label: "Name",
        kind: "text",
        operator: "contains",
        operand: "Mario",
      },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Remove Name filter" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
