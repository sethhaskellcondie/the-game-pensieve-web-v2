import type { ActiveFilter, FilterFieldKind, FilterOperator } from "./types";

// The query-param name a collection page reads to pre-apply filters — set by the
// home dashboard's saved-filter cards so a click opens the page already filtered.
export const FILTERS_PARAM = "filters";

// The minimal per-condition shape carried in the URL: enough to render the chip
// and build the search request. Heavier fields (options) are re-resolved from
// the page's live field list.
type EncodableCondition = {
  field: string;
  label: string;
  kind: FilterFieldKind;
  operator: FilterOperator;
  operand: string;
  operandLabel?: string;
};

// Encode conditions into the `filters` param value: a JSON array.
// (URLSearchParams handles the percent-encoding when the URL is built.)
export function encodeFilterParam(conditions: EncodableCondition[]): string {
  return JSON.stringify(
    conditions.map((c) => ({
      field: c.field,
      label: c.label,
      kind: c.kind,
      operator: c.operator,
      operand: c.operand,
      ...(c.operandLabel != null ? { operandLabel: c.operandLabel } : {}),
    })),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Decode the `filters` param into ActiveFilters that seed a manager's filter bar.
// Defensive: a malformed param yields no filters. Ids are deterministic
// (index-based) so the server and client render identically — and once on the
// page these behave like any hand-entered filter (editable / removable).
export function decodeFilterParam(
  param: string | string[] | undefined,
): ActiveFilter[] {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: ActiveFilter[] = [];
  parsed.forEach((c, i) => {
    if (!isRecord(c)) return;
    const { field, label, kind, operator, operand, operandLabel } = c;
    if (
      typeof field !== "string" ||
      typeof operator !== "string" ||
      typeof operand !== "string"
    ) {
      return;
    }
    const filter: ActiveFilter = {
      id: `url-${i}`,
      field,
      label: typeof label === "string" ? label : field,
      kind: (typeof kind === "string" ? kind : "text") as FilterFieldKind,
      operator: operator as FilterOperator,
      operand,
    };
    if (typeof operandLabel === "string") filter.operandLabel = operandLabel;
    out.push(filter);
  });
  return out;
}
