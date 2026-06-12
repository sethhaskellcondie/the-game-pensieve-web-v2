// Client-side helpers for the per-entity default sort options: fetching the
// stored record through its route handler and converting between the stored
// { field, direction } levels and the ActiveSort shape the sort UI and the
// search serializers work with. Shared by the Options page (which edits the
// defaults) and the collection managers (which seed their sort state from
// them).

import {
  EMPTY_DEFAULT_SORT_OPTIONS,
  asDefaultSortOptions,
  type DefaultSortLevel,
  type DefaultSortOptions,
} from "@/lib/defaultSortOptions.types";
import { newFilterId } from "./ids";
import type { ActiveSort, FilterFieldDef } from "./types";

// Fetches the stored default sort options. Never throws: an unreachable
// backend or a malformed payload degrades to "no defaults" so a collection
// page can always load.
export async function fetchDefaultSortOptions(
  signal?: AbortSignal,
): Promise<DefaultSortOptions> {
  try {
    const res = await fetch("/api/default-sort-options", { signal });
    if (!res.ok) return { ...EMPTY_DEFAULT_SORT_OPTIONS };
    return asDefaultSortOptions(await res.json());
  } catch {
    return { ...EMPTY_DEFAULT_SORT_OPTIONS };
  }
}

// Resolves stored default sort levels against an entity's current field list,
// producing the ActiveSort levels SortControl and toSortRequest understand.
// Levels whose field no longer exists (e.g. a deleted custom field) are
// dropped, and a repeated field keeps only its first (highest-priority) level
// — matching SortControl's one-level-per-field rule.
export function resolveDefaultSorts(
  levels: DefaultSortLevel[],
  fields: FilterFieldDef[],
): ActiveSort[] {
  const byField = new Map(fields.map((f) => [f.field, f]));
  const out: ActiveSort[] = [];
  const used = new Set<string>();
  for (const level of levels) {
    const def = byField.get(level.field);
    if (!def || used.has(level.field)) continue;
    used.add(level.field);
    out.push({
      id: newFilterId(),
      field: def.field,
      label: def.label,
      direction: level.direction,
    });
  }
  return out;
}

// The inverse of resolveDefaultSorts, for persisting: strips the UI-local
// id and label down to the stored { field, direction } shape.
export function toDefaultSortLevels(sorts: ActiveSort[]): DefaultSortLevel[] {
  return sorts.map((s) => ({ field: s.field, direction: s.direction }));
}

// The sort levels a search request should carry: the page's own levels when
// the user has entered any, otherwise the stored defaults. Used when building
// the request (never fed back into the Sort button's state), so the default
// applies on load and again after "Clear sorting", while any page sort is
// used exclusively.
export function sortsOrDefault(
  next: ActiveSort[],
  defaults: ActiveSort[],
): ActiveSort[] {
  return next.length === 0 ? defaults : next;
}
