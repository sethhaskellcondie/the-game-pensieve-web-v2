import type { EntityKey, FilterRequestDto } from "@/lib/api";
import type { ActiveFilter, FilterFieldKind } from "./types";

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
