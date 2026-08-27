import type {
  ActiveFilter,
  ActiveSort,
  FilterFieldKind,
  FilterOperator,
  SortDirection,
} from "./types";

// The query-param names a collection page reads to pre-apply a saved view — set
// by the home dashboard's saved-filter cards so a click opens the page already
// filtered and sorted.
export const FILTERS_PARAM = "filters";
export const SORTS_PARAM = "sorts";

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

// The minimal per-level shape carried in the URL (and, via the same helpers, in
// localStorage): the UI-local id is dropped and the label is snapshotted so a
// chip still reads without re-resolving the field list.
type EncodableSort = {
  field: string;
  label: string;
  direction: SortDirection;
};

// Encode sort levels into the `sorts` param value: a JSON array. Array order is
// the sort priority (primary first), which the backend honors as-is.
export function encodeSortParam(sorts: EncodableSort[]): string {
  return JSON.stringify(
    sorts.map((s) => ({
      field: s.field,
      label: s.label,
      direction: s.direction,
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

// Decode the `sorts` param into ActiveSorts that seed a page's sort levels.
// Defensive: a malformed param, or any level missing a field or carrying an
// unknown direction, is dropped, so corrupt input degrades to "no sorts". Ids
// are deterministic (index-based) for the same reason the filter ids are — the
// seeded levels are rendered on the server too (the Sort button shows a level
// count), so server and client must agree.
export function decodeSortParam(
  param: string | string[] | undefined,
): ActiveSort[] {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: ActiveSort[] = [];
  parsed.forEach((level, i) => {
    if (!isRecord(level)) return;
    const { field, label, direction } = level;
    if (typeof field !== "string") return;
    if (direction !== "asc" && direction !== "desc") return;
    out.push({
      id: `sort-${i}`,
      field,
      label: typeof label === "string" ? label : field,
      direction,
    });
  });
  return out;
}
