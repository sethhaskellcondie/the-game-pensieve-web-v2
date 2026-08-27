import {
  normalizeFilters,
  parseSavedFiltersValue,
  serializeSavedFilters,
  type StoredFilter,
} from "@/lib/savedFilters.types";

// A minimal well-formed stored filter; overrides shape whichever part a test is
// about.
function filter(overrides: Partial<StoredFilter> = {}): StoredFilter {
  return {
    id: "f1",
    name: "Boxed toys",
    entity: "toy",
    categoryId: "c1",
    order: 0,
    conditions: [
      {
        id: "c-1",
        field: "name",
        label: "Name",
        kind: "text",
        source: "standard",
        operator: "contains",
        operand: "R2",
      },
    ],
    sorts: [{ id: "s-1", field: "name", label: "Name", direction: "asc" }],
    ...overrides,
  };
}

describe("saved filter sort levels", () => {
  it("keeps well-formed levels in priority order", () => {
    const sorts = [
      { id: "s-1", field: "name", label: "Name", direction: "asc" as const },
      { id: "s-2", field: "set", label: "Set", direction: "desc" as const },
    ];
    expect(normalizeFilters([filter({ sorts })])[0].sorts).toEqual(sorts);
  });

  it("defaults a filter saved before sorting existed to no sorts", () => {
    // The pre-sorting stored shape: no `sorts` key at all.
    const legacy = { ...filter() } as Partial<StoredFilter>;
    delete legacy.sorts;

    const [normalized] = normalizeFilters([legacy]);
    expect(normalized.sorts).toEqual([]);
    // The rest of the record survives untouched — no migration needed.
    expect(normalized.conditions).toHaveLength(1);
    expect(normalized.name).toBe("Boxed toys");
  });

  it("drops levels missing a field or carrying an unknown direction", () => {
    const [normalized] = normalizeFilters([
      filter({
        sorts: [
          { label: "No field", direction: "asc" },
          { field: "set", label: "Set", direction: "sideways" },
          { id: "s-3", field: "name", label: "Name", direction: "desc" },
        ] as unknown as StoredFilter["sorts"],
      }),
    ]);
    expect(normalized.sorts).toEqual([
      { id: "s-3", field: "name", label: "Name", direction: "desc" },
    ]);
  });

  it("keeps only the highest-priority level for a repeated field", () => {
    const [normalized] = normalizeFilters([
      filter({
        sorts: [
          { id: "s-1", field: "name", label: "Name", direction: "asc" },
          { id: "s-2", field: "name", label: "Name", direction: "desc" },
        ],
      }),
    ]);
    expect(normalized.sorts).toEqual([
      { id: "s-1", field: "name", label: "Name", direction: "asc" },
    ]);
  });

  it("fills in an id and label when they are missing", () => {
    const [normalized] = normalizeFilters([
      filter({
        sorts: [{ field: "set", direction: "desc" }] as unknown as StoredFilter["sorts"],
      }),
    ]);
    expect(normalized.sorts).toEqual([
      { id: "sort-0", field: "set", label: "set", direction: "desc" },
    ]);
  });

  it("round-trips sorts through serialize/parse", () => {
    const filters = [filter()];
    expect(parseSavedFiltersValue(serializeSavedFilters(filters))).toEqual(
      filters,
    );
  });
});
