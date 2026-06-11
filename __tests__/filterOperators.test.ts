import {
  OPERATORS_BY_KIND,
  operatorLabel,
  operatorsForKind,
} from "@/components/filters/operators";
import { customKind } from "@/components/filters/fieldList";
import type { CustomFieldType } from "@/lib/api";

describe("operatorsForKind", () => {
  it("returns text operators for text fields", () => {
    expect(operatorsForKind("text")).toEqual([
      "equals",
      "not_equals",
      "contains",
      "starts_with",
      "ends_with",
    ]);
  });

  it("returns the comparison operators for number fields", () => {
    expect(operatorsForKind("number")).toEqual([
      "equals",
      "not_equals",
      "greater_than",
      "less_than",
      "greater_than_equal_to",
      "less_than_equal_to",
    ]);
  });

  it("returns only equals for boolean fields", () => {
    expect(operatorsForKind("boolean")).toEqual(["equals"]);
  });

  it("returns since/before for time fields", () => {
    expect(operatorsForKind("time")).toEqual(["since", "before"]);
  });

  it("returns equals/not_equals for system and option kinds", () => {
    for (const kind of [
      "system",
      "dropdown",
      "radio_button",
      "progress_bar",
    ] as const) {
      expect(operatorsForKind(kind)).toEqual(["equals", "not_equals"]);
    }
  });

  it("covers every kind in OPERATORS_BY_KIND", () => {
    for (const ops of Object.values(OPERATORS_BY_KIND)) {
      expect(ops.length).toBeGreaterThan(0);
    }
  });
});

describe("operatorLabel", () => {
  it("maps operators to human-readable labels", () => {
    expect(operatorLabel("equals")).toBe("is");
    expect(operatorLabel("not_equals")).toBe("is not");
    expect(operatorLabel("greater_than_equal_to")).toBe("≥");
  });
});

describe("customKind", () => {
  it("maps each custom field type to a filter kind of the same name", () => {
    const types: CustomFieldType[] = [
      "text",
      "number",
      "boolean",
      "dropdown",
      "radio_button",
      "progress_bar",
    ];
    for (const t of types) expect(customKind(t)).toBe(t);
  });
});
