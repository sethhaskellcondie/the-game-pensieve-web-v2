// Shape, key, and (de)serialization for saved-filter categories — the named,
// orderable groups on the home dashboard.
//
// These are persisted in the backend "metadata" store under the key
// `saved-filter-categories`, where the record's `value` field holds a
// JSON-encoded STRING: an array of { id, name, order } objects.
//
// This module is intentionally free of any server-only code (no API_BASE_URL,
// no fetch) so it is safe to import from Client Components. The parse/serialize
// helpers run on both sides of the route-handler boundary.

export const SAVED_FILTER_CATEGORIES_KEY = "saved-filter-categories";

// The reserved id of the always-present "Uncategorized" row — the home for
// saved filters not assigned to a category. It's stored alongside the real
// categories (so its reorderable position persists), but the UI never lets it
// be renamed or deleted, and its display name is always forced to the value
// below regardless of what's stored.
export const UNCATEGORIZED_ID = "__uncategorized__";
export const UNCATEGORIZED_NAME = "Uncategorized";

// One stored category: a stable id, a display name, and its 0-based position.
export type StoredCategory = {
  id: string;
  name: string;
  order: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Normalizes an arbitrary value into a clean, ordered StoredCategory[]: keeps
// only well-formed { id, name } records, de-dupes ids, sorts by the stored
// order, guarantees the Uncategorized row exists (appended last if absent) with
// its canonical name, and reassigns `order` to the final index so positions are
// always contiguous 0..n-1. Used at every boundary (load, save, route POST) so
// a malformed or partial store can never reach the UI.
export function normalizeCategories(value: unknown): StoredCategory[] {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const cleaned: StoredCategory[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === "string" ? item.id : null;
    const name = typeof item.name === "string" ? item.name : null;
    if (id == null || name == null || seen.has(id)) continue;
    seen.add(id);
    const order = typeof item.order === "number" ? item.order : cleaned.length;
    cleaned.push({ id, name, order });
  }
  cleaned.sort((a, b) => a.order - b.order);
  if (!seen.has(UNCATEGORIZED_ID)) {
    cleaned.push({
      id: UNCATEGORIZED_ID,
      name: UNCATEGORIZED_NAME,
      order: cleaned.length,
    });
  }
  return cleaned.map((c, i) => ({
    id: c.id,
    name: c.id === UNCATEGORIZED_ID ? UNCATEGORIZED_NAME : c.name,
    order: i,
  }));
}

// The default store for a fresh install: just the Uncategorized row.
export const DEFAULT_SAVED_FILTER_CATEGORIES: StoredCategory[] =
  normalizeCategories([]);

// Parses the metadata `value` JSON string into a normalized StoredCategory[].
// Defensive: malformed JSON falls back to just the Uncategorized row rather
// than throwing, so a corrupt stored value can never crash a render.
export function parseSavedFilterCategoriesValue(
  value: string,
): StoredCategory[] {
  try {
    return normalizeCategories(JSON.parse(value));
  } catch {
    return normalizeCategories([]);
  }
}

// Serializes categories into the JSON string the backend stores, reassigning
// `order` to the array index so display order is the single source of truth.
export function serializeSavedFilterCategories(
  categories: StoredCategory[],
): string {
  return JSON.stringify(normalizeCategories(categories));
}
