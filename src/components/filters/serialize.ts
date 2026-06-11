import type { EntityKey, FilterRequestDto } from "@/lib/api";
import { searchField } from "./fieldList";
import type { ActiveFilter, FilterFieldDef, FilterFieldKind } from "./types";

// The id given to the synthetic filter the quick-search box contributes, so it
// is easy to recognize and never collides with a user-added chip.
export const SEARCH_FILTER_ID = "__search__";

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

// Combine the quick-search text with the explicit filter chips into the full set
// to send. The search text becomes a "contains" filter on the entity's search
// field — UNLESS the user has already added an explicit chip on that field, in
// which case the chip wins and the search text is ignored (avoids two competing
// name filters).
export function effectiveFilters(
  query: string,
  filters: ActiveFilter[],
  fields: FilterFieldDef[],
): ActiveFilter[] {
  const q = query.trim();
  if (q === "") return filters;
  const sf = searchField(fields);
  if (!sf) return filters;
  if (filters.some((f) => f.field === sf.field)) return filters;
  const synthetic: ActiveFilter = {
    id: SEARCH_FILTER_ID,
    field: sf.field,
    label: sf.label,
    kind: "text",
    operator: "contains",
    operand: q,
  };
  return [...filters, synthetic];
}
