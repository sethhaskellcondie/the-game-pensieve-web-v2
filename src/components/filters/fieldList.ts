import type {
  CustomField,
  CustomFieldType,
  FilterSpecification,
} from "@/lib/api";
import { operatorsForKind } from "./operators";
import type { FilterFieldDef, FilterFieldKind, FilterOperator } from "./types";

// Spec field types that aren't user-facing filters — dropped from the picker.
// `sort`/`pagination` are backend pseudo-fields; `time` (created_at/updated_at)
// is excluded for now since timestamp filtering isn't part of this work.
const PSEUDO_TYPES = new Set(["sort", "pagination", "time"]);

// The field kinds the UI knows how to render. Any spec type outside this set
// (and the pseudo-types above) is skipped so the picker never offers a dead
// field.
const KNOWN_KINDS = new Set<FilterFieldKind>([
  "text",
  "number",
  "boolean",
  "time",
  "system",
  "dropdown",
  "radio_button",
  "progress_bar",
]);

// Custom field types map straight onto filter kinds of the same name; the
// option-bearing ones (dropdown/radio/progress) stay distinct so the value
// input can offer an option picker.
export function customKind(type: CustomFieldType): FilterFieldKind {
  return type;
}

// Sort operators a field's spec entry may carry. Enum custom fields now
// advertise these in their own operator list (alongside equals/not_equals);
// they drive the Sort control, not the filter operator picker, so they're
// stripped from a field's filter operators in buildFieldList.
const SORT_OPERATORS = new Set<string>(["order_by", "order_by_desc"]);

// Title-case a backend field name for display ("created_at" → "Created At").
function humanize(field: string): string {
  return field
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Display label for a standard (non-custom) spec field. The system field is
// keyed "system_id" but filters/sorts by the system itself, so it reads as
// "System" rather than the humanized "System Id" everywhere it surfaces.
function standardLabel(field: string, kind: FilterFieldKind): string {
  return kind === "system" ? "System" : humanize(field);
}

// Build the user-facing filter field list from the backend spec, which is the
// single source of truth: it lists every filterable field (standard AND custom,
// keyed by name) with the operators each accepts. The custom-field definitions
// are used only to (a) mark which spec fields are custom — so they get the
// right glyph — and (b) supply the option lists the spec doesn't carry. Fields
// keep the spec's order (standard fields come first); pseudo-fields
// (sort/pagination) and unknown kinds are skipped.
export function buildFieldList(
  spec: FilterSpecification | null,
  customFields: CustomField[],
): FilterFieldDef[] {
  if (!spec) return [];
  const byName = new Map(customFields.map((c) => [c.name, c]));
  const out: FilterFieldDef[] = [];
  for (const [field, type] of Object.entries(spec.fields)) {
    if (PSEUDO_TYPES.has(type)) continue;
    const kind = type as FilterFieldKind;
    if (!KNOWN_KINDS.has(kind)) continue;
    const def = byName.get(field);
    const specOps = spec.filters[field] as FilterOperator[] | undefined;
    // Sort operators (order_by/order_by_desc) belong to the Sort control, not
    // the filter operator picker, so they're dropped from the filter operators.
    const filterOps = specOps?.filter((op) => !SORT_OPERATORS.has(op));
    const operators =
      filterOps && filterOps.length > 0 ? filterOps : operatorsForKind(kind);
    const entry: FilterFieldDef = {
      field,
      label: def ? def.name : standardLabel(field, kind),
      kind,
      source: def ? "custom" : "standard",
      operators,
    };
    if (def?.id != null) entry.customFieldId = def.id;
    if (def && def.options.length > 0) {
      entry.options = [...def.options].sort((a, b) => a.order - b.order);
    }
    out.push(entry);
  }
  return out;
}

// The subset of a field list the sort controls may offer. Every filterable
// field is sortable: the backend sorts the standard fields and — since it added
// order_by/order_by_desc for the enum custom kinds (dropdown/radio_button/
// progress_bar) — the option-bearing custom fields too, ordering them by the
// option's display order rather than its id. Kept as a named seam for the sort
// controls even though it no longer narrows the list.
export function sortableFields(fields: FilterFieldDef[]): FilterFieldDef[] {
  return fields;
}

// Whether the spec advertises sorting via its sort capability marker (the
// "all_fields": "sort" entry). The marker is metadata only — sort filters send
// the actual field name, never the marker itself (the backend rejects it).
export function supportsSorting(spec: FilterSpecification | null): boolean {
  if (!spec) return false;
  return Object.values(spec.fields).some((type) => type === "sort");
}

// The field the quick-search box maps onto: the standard text field named
// "name" (fallback "title"), else the first standard text field. Returns null
// when there's no text field to search.
export function searchField(fields: FilterFieldDef[]): FilterFieldDef | null {
  const textFields = fields.filter(
    (f) => f.source === "standard" && f.kind === "text",
  );
  return (
    textFields.find((f) => f.field === "name") ??
    textFields.find((f) => f.field === "title") ??
    textFields[0] ??
    null
  );
}
