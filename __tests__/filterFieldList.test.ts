import {
  buildFieldList,
  searchField,
  supportsSorting,
} from "@/components/filters/fieldList";
import type { CustomField, FilterSpecification } from "@/lib/api";

// The spec is the single source of truth: it lists standard AND custom fields
// (keyed by name) with each field's operators. Mirrors the real /filters/toy
// response shape.
const spec: FilterSpecification = {
  type: "toy_filters",
  fields: {
    name: "text",
    set: "text",
    created_at: "time",
    all_fields: "sort",
    pagination_fields: "pagination",
    Notes: "text",
    Series: "dropdown",
    Quantity: "number",
  },
  filters: {
    name: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    set: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    created_at: ["since", "before"],
    all_fields: ["order_by", "order_by_desc"],
    pagination_fields: ["limit", "offset"],
    Notes: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    Series: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    Quantity: [
      "equals",
      "not_equals",
      "greater_than",
      "greater_than_equal_to",
      "less_than",
      "less_than_equal_to",
    ],
  },
};

const customFields: CustomField[] = [
  { id: 10, name: "Notes", type: "text", entityKey: "toy", order: 0, options: [] },
  { id: 11, name: "Quantity", type: "number", entityKey: "toy", order: 1, options: [] },
  {
    id: 12,
    name: "Series",
    type: "dropdown",
    entityKey: "toy",
    order: 2,
    options: [
      { id: 22, customFieldId: 12, name: "Special", isDefault: false, order: 1 },
      { id: 21, customFieldId: 12, name: "Original", isDefault: true, order: 0 },
    ],
  },
  // A custom field the spec doesn't list — must NOT appear (spec is authoritative).
  { id: 13, name: "Ghost", type: "text", entityKey: "toy", order: 3, options: [] },
];

describe("buildFieldList", () => {
  it("uses the spec for the field set and drops sort/pagination/time fields", () => {
    const tokens = buildFieldList(spec, customFields).map((f) => f.field);
    expect(tokens).toEqual(["name", "set", "Notes", "Series", "Quantity"]);
    expect(tokens).not.toContain("all_fields");
    expect(tokens).not.toContain("pagination_fields");
    // Timestamp filtering is excluded from this part of the project.
    expect(tokens).not.toContain("created_at");
  });

  it("only includes spec fields, never custom fields absent from the spec", () => {
    const tokens = buildFieldList(spec, customFields).map((f) => f.field);
    expect(tokens).not.toContain("Ghost");
  });

  it("marks spec fields as standard or custom by matching custom definitions", () => {
    const fields = buildFieldList(spec, customFields);
    const bySource = (source: "standard" | "custom") =>
      fields.filter((f) => f.source === source).map((f) => f.field);
    expect(bySource("standard")).toEqual(["name", "set"]);
    expect(bySource("custom")).toEqual(["Notes", "Series", "Quantity"]);
  });

  it("carries each standard field's label and spec operators", () => {
    const fields = buildFieldList(spec, customFields);
    const set = fields.find((f) => f.field === "set")!;
    expect(set.label).toBe("Set");
    expect(set.kind).toBe("text");
    expect(set.operators).toEqual([
      "equals",
      "not_equals",
      "contains",
      "starts_with",
      "ends_with",
    ]);
  });

  it("takes custom-field operators straight from the spec (not derived)", () => {
    const quantity = buildFieldList(spec, customFields).find(
      (f) => f.field === "Quantity",
    )!;
    expect(quantity.source).toBe("custom");
    expect(quantity.customFieldId).toBe(11);
    // The backend's order (gt, gte, lt, lte), not the local fallback order.
    expect(quantity.operators).toEqual([
      "equals",
      "not_equals",
      "greater_than",
      "greater_than_equal_to",
      "less_than",
      "less_than_equal_to",
    ]);
  });

  it("attaches sorted options to option-bearing custom fields", () => {
    const series = buildFieldList(spec, customFields).find(
      (f) => f.field === "Series",
    )!;
    expect(series.kind).toBe("dropdown");
    expect(series.options?.map((o) => o.name)).toEqual(["Original", "Special"]);
  });

  it("skips spec fields whose kind the UI can't render", () => {
    const weird: FilterSpecification = {
      type: "toy_filters",
      fields: { name: "text", mystery: "geo" },
      filters: { name: ["equals"], mystery: ["near"] },
    };
    expect(buildFieldList(weird, []).map((f) => f.field)).toEqual(["name"]);
  });

  it("returns an empty list when the spec is missing", () => {
    expect(buildFieldList(null, customFields)).toEqual([]);
  });
});

describe("supportsSorting", () => {
  it("is true when the spec carries the sort capability marker", () => {
    expect(supportsSorting(spec)).toBe(true);
  });

  it("is false when the spec has no sort marker", () => {
    const noSort: FilterSpecification = {
      type: "toy_filters",
      fields: { name: "text" },
      filters: { name: ["equals"] },
    };
    expect(supportsSorting(noSort)).toBe(false);
  });

  it("is false when the spec is missing", () => {
    expect(supportsSorting(null)).toBe(false);
  });
});

describe("searchField", () => {
  it("prefers a standard field named name", () => {
    expect(searchField(buildFieldList(spec, customFields))?.field).toBe("name");
  });

  it("falls back to title then the first text field", () => {
    const titleSpec: FilterSpecification = {
      type: "videoGame_filters",
      fields: { title: "text", note: "text" },
      filters: { title: ["contains"], note: ["contains"] },
    };
    expect(searchField(buildFieldList(titleSpec, []))?.field).toBe("title");
  });

  it("returns null when there is no standard text field", () => {
    const noText: FilterSpecification = {
      type: "toy_filters",
      fields: { created_at: "time" },
      filters: { created_at: ["since"] },
    };
    expect(searchField(buildFieldList(noText, []))).toBeNull();
  });
});
