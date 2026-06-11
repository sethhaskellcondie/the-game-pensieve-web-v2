import type { FilterFieldKind, FilterOperator } from "./types";

// The operators each field kind accepts. The standard kinds mirror the backend
// filter spec; the option-bearing custom kinds (dropdown/radio/progress) are
// treated as equality matches on the selected option name.
export const OPERATORS_BY_KIND: Record<FilterFieldKind, FilterOperator[]> = {
  text: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
  number: [
    "equals",
    "not_equals",
    "greater_than",
    "less_than",
    "greater_than_equal_to",
    "less_than_equal_to",
  ],
  boolean: ["equals"],
  time: ["since", "before"],
  system: ["equals", "not_equals"],
  dropdown: ["equals", "not_equals"],
  radio_button: ["equals", "not_equals"],
  progress_bar: ["equals", "not_equals"],
};

// Human-readable labels for each operator, shown in the operator picker and on
// chips (e.g. "Name is Mario", "Year ≥ 1990").
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  starts_with: "starts with",
  ends_with: "ends with",
  greater_than: ">",
  less_than: "<",
  greater_than_equal_to: "≥",
  less_than_equal_to: "≤",
  since: "since",
  before: "before",
};

export function operatorsForKind(kind: FilterFieldKind): FilterOperator[] {
  return OPERATORS_BY_KIND[kind] ?? [];
}

export function operatorLabel(operator: FilterOperator): string {
  return OPERATOR_LABELS[operator] ?? operator;
}
