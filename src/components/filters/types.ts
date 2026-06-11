import type { CustomFieldOption, EntityKey } from "@/lib/api";

// The kinds a filterable field can have. The first group comes from the
// backend filter spec (FilterSpecification.fields), the second from custom
// fields (CustomFieldType) — option-bearing custom kinds are kept distinct so
// the value input can offer a picker. `sort` and `pagination` pseudo-fields are
// intentionally excluded: they aren't user-facing filters.
export type FilterFieldKind =
  | "text"
  | "number"
  | "boolean"
  | "time"
  | "system"
  | "dropdown"
  | "radio_button"
  | "progress_bar";

// The operators a filter can use. Mirrors the enum in FilterRequestDto, minus
// the sort/pagination operators which the UI never builds.
export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "less_than"
  | "greater_than_equal_to"
  | "less_than_equal_to"
  | "since"
  | "before";

// A field the user can filter on — the unified view over standard + custom
// fields. `field` is the token sent to the backend (`name`, `set`, or a custom
// field's token). `options` is present only for the option-bearing custom kinds.
export type FilterFieldDef = {
  field: string;
  label: string;
  kind: FilterFieldKind;
  source: "standard" | "custom";
  operators: FilterOperator[];
  options?: CustomFieldOption[];
  customFieldId?: number;
  // Value/label choices for fields whose operand is an id that should display
  // as a label (e.g. a video game's system_id → system names). When present
  // (and the operator is an equality), the value input offers a listbox of the
  // labels and commits the value.
  valueOptions?: { value: string; label: string }[];
};

// One applied filter held in component state. `id` is a local key for React and
// for targeting edit/remove; `operand` is always a string (the backend's
// contract). `label`/`kind`/`options` are snapshots of the field so a chip can
// render and re-open the editor without re-resolving the field list.
export type ActiveFilter = {
  id: string;
  field: string;
  label: string;
  kind: FilterFieldKind;
  operator: FilterOperator;
  operand: string;
  options?: CustomFieldOption[];
  // Display label for an id operand, snapshotted when the filter is applied so
  // the chip can show e.g. the system's name instead of its numeric id.
  operandLabel?: string;
};

export type { EntityKey };
