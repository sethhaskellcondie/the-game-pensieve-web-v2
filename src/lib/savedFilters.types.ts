// Shape, key, and (de)serialization for saved filters — the shortcut cards on
// the home dashboard.
//
// Persisted in the backend "metadata" store under the key `saved-filters`, where
// the record's `value` field holds a JSON-encoded STRING: an array of filter
// objects. Each filter belongs to exactly one category (by `categoryId`) and
// carries its `order` within that category — so reordering within a category and
// moving between categories are both just edits to these two fields.
//
// This module is free of server-only code (no API_BASE_URL, no fetch) so it is
// safe to import from Client Components.

import type { EntityKey } from "@/lib/api";
import type { FilterFieldKind, FilterOperator } from "@/components/filters/types";

export const SAVED_FILTERS_KEY = "saved-filters";

const ENTITY_KEYS: ReadonlySet<string> = new Set<EntityKey>([
  "toy",
  "system",
  "videoGame",
  "videoGameBox",
  "boardGame",
  "boardGameBox",
]);

// One stored filter condition — the persistable subset of an ActiveFilter plus
// its field source (for the glyph). The heavy `options` array isn't stored: it's
// re-resolved from the live field list when the filter is edited, and the chip
// display only needs the snapshotted `operandLabel`.
export type StoredFilterCondition = {
  id: string;
  field: string;
  label: string;
  kind: FilterFieldKind;
  source: "standard" | "custom";
  operator: FilterOperator;
  operand: string;
  operandLabel?: string;
};

// One stored saved filter: its identity, target collection, owning category,
// position within that category, and its conditions.
export type StoredFilter = {
  id: string;
  name: string;
  entity: EntityKey;
  categoryId: string;
  order: number;
  conditions: StoredFilterCondition[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Keeps only structurally valid conditions, dropping any with a missing/typed
// field so a corrupt entry can't crash a render.
function normalizeConditions(value: unknown): StoredFilterCondition[] {
  const raw = Array.isArray(value) ? value : [];
  const out: StoredFilterCondition[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const { id, field, label, kind, source, operator, operand, operandLabel } =
      item;
    if (
      typeof id !== "string" ||
      typeof field !== "string" ||
      typeof label !== "string" ||
      typeof kind !== "string" ||
      typeof operator !== "string" ||
      typeof operand !== "string"
    ) {
      continue;
    }
    const cond: StoredFilterCondition = {
      id,
      field,
      label,
      kind: kind as FilterFieldKind,
      source: source === "standard" ? "standard" : "custom",
      operator: operator as FilterOperator,
      operand,
    };
    if (typeof operandLabel === "string") cond.operandLabel = operandLabel;
    out.push(cond);
  }
  return out;
}

// Normalizes an arbitrary value into a clean StoredFilter[]: keeps only
// well-formed records (string id/name/categoryId and a known entity), de-dupes
// ids, and coerces `order` to a number. `categoryId` references are NOT
// validated here — the categories live in a separate store, so a filter whose
// category was deleted is reassigned to Uncategorized when the dashboard groups
// them on load.
export function normalizeFilters(value: unknown): StoredFilter[] {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const out: StoredFilter[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === "string" ? item.id : null;
    const name = typeof item.name === "string" ? item.name : null;
    const entity =
      typeof item.entity === "string" && ENTITY_KEYS.has(item.entity)
        ? (item.entity as EntityKey)
        : null;
    const categoryId =
      typeof item.categoryId === "string" ? item.categoryId : null;
    if (
      id == null ||
      name == null ||
      entity == null ||
      categoryId == null ||
      seen.has(id)
    ) {
      continue;
    }
    seen.add(id);
    const order = typeof item.order === "number" ? item.order : out.length;
    out.push({
      id,
      name,
      entity,
      categoryId,
      order,
      conditions: normalizeConditions(item.conditions),
    });
  }
  return out;
}

// The default store for a fresh install: no saved filters yet.
export const DEFAULT_SAVED_FILTERS: StoredFilter[] = [];

// Parses the metadata `value` JSON string into a normalized StoredFilter[].
// Defensive: malformed JSON falls back to an empty list.
export function parseSavedFiltersValue(value: string): StoredFilter[] {
  try {
    return normalizeFilters(JSON.parse(value));
  } catch {
    return [];
  }
}

// Serializes saved filters to the JSON string the backend stores.
export function serializeSavedFilters(filters: StoredFilter[]): string {
  return JSON.stringify(normalizeFilters(filters));
}
