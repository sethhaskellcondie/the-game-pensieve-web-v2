import {
  resolveDefaultSorts,
  sortsOrDefault,
  toDefaultSortLevels,
} from "@/components/filters/defaultSorts";
import type { ActiveSort, FilterFieldDef } from "@/components/filters/types";

const FIELDS: FilterFieldDef[] = [
  {
    field: "name",
    label: "Name",
    kind: "text",
    source: "standard",
    operators: ["equals", "contains"],
  },
  {
    field: "Release Year",
    label: "Release Year",
    kind: "number",
    source: "custom",
    operators: ["equals"],
    customFieldId: 31,
  },
];

describe("resolveDefaultSorts", () => {
  it("resolves stored levels to ActiveSorts with the field's label", () => {
    const resolved = resolveDefaultSorts(
      [
        { field: "Release Year", direction: "desc" },
        { field: "name", direction: "asc" },
      ],
      FIELDS,
    );

    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toMatchObject({
      field: "Release Year",
      label: "Release Year",
      direction: "desc",
    });
    expect(resolved[1]).toMatchObject({
      field: "name",
      label: "Name",
      direction: "asc",
    });
    // Each level gets its own local id (React keys / edit targeting).
    expect(resolved[0].id).not.toBe(resolved[1].id);
  });

  it("drops levels whose field is no longer in the field list", () => {
    const resolved = resolveDefaultSorts(
      [
        { field: "deleted_custom_field", direction: "asc" },
        { field: "name", direction: "desc" },
      ],
      FIELDS,
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ field: "name", direction: "desc" });
  });

  it("keeps only the first level for a repeated field", () => {
    const resolved = resolveDefaultSorts(
      [
        { field: "name", direction: "desc" },
        { field: "name", direction: "asc" },
      ],
      FIELDS,
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0].direction).toBe("desc");
  });
});

describe("sortsOrDefault", () => {
  const defaults: ActiveSort[] = [
    { id: "d", field: "name", label: "Name", direction: "asc" },
  ];

  it("keeps the user's levels when there are any", () => {
    const next: ActiveSort[] = [
      { id: "u", field: "Release Year", label: "Release Year", direction: "desc" },
    ];
    expect(sortsOrDefault(next, defaults)).toBe(next);
  });

  it("falls back to the defaults (same identity) when cleared", () => {
    expect(sortsOrDefault([], defaults)).toBe(defaults);
  });

  it("stays empty when there is no default either", () => {
    expect(sortsOrDefault([], [])).toEqual([]);
  });
});

describe("toDefaultSortLevels", () => {
  it("strips the UI-local id and label down to field + direction", () => {
    const sorts: ActiveSort[] = [
      { id: "a", field: "name", label: "Name", direction: "asc" },
      { id: "b", field: "Release Year", label: "Release Year", direction: "desc" },
    ];

    expect(toDefaultSortLevels(sorts)).toEqual([
      { field: "name", direction: "asc" },
      { field: "Release Year", direction: "desc" },
    ]);
  });
});
