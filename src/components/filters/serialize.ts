import type { EntityKey, FilterRequestDto } from "@/lib/api";
import type { ActiveFilter, ActiveSort, FilterFieldKind } from "./types";

// Coerce an operand to the string shape the backend expects for its kind. Most
// values are already correct strings; time values from a <input type="date">
// arrive as "YYYY-MM-DD" and are widened to an ISO datetime.
function coerceOperand(kind: FilterFieldKind, operand: string): string {
  const v = operand.trim();
  if (kind === "time" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return `${v}T00:00:00`;
  }
  return v;
}

// Turn the active filters into the backend payload. Filters with an empty
// operand are dropped (they're incomplete), and every operand is coerced to a
// string per its kind.
export function toFilterRequest(
  key: EntityKey,
  filters: ActiveFilter[],
): FilterRequestDto[] {
  const out: FilterRequestDto[] = [];
  for (const f of filters) {
    if (f.operand.trim() === "") continue;
    out.push({
      key,
      field: f.field,
      operator: f.operator,
      operand: coerceOperand(f.kind, f.operand),
    });
  }
  return out;
}

// Turn the active sort levels into backend sort filters: each level sends the
// sorted-by field name as `field` with an order_by/order_by_desc operator; the
// operand is required by the DTO shape but ignored for sorts, so it's sent
// empty. Array order is preserved — the backend treats the first sort filter
// as primary, the next as tiebreaker, and so on. Appended after the regular
// filters by callers. (The spec's "all_fields" entry is only a capability
// marker — see supportsSorting — and is rejected if sent as a sort field.)
export function toSortRequest(
  key: EntityKey,
  sorts: ActiveSort[],
): FilterRequestDto[] {
  return sorts.map((s) => ({
    key,
    field: s.field,
    operator: s.direction === "desc" ? "order_by_desc" : "order_by",
    operand: "",
  }));
}
