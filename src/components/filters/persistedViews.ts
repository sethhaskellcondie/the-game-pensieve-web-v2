"use client";

// The per-page collection view preferences — a page's applied filters and its
// sort levels — live in localStorage, keyed per entity (e.g. "filters:video-game",
// "sorts:video-game"). See usePersistentFilters / usePersistentSorts. These two
// prefixes are the single source of truth for those key namespaces; the hooks
// import them from here.
export const FILTERS_STORAGE_PREFIX = "filters:";
export const SORTS_STORAGE_PREFIX = "sorts:";

// Wipe every persisted filter and sort preference across all collection pages.
//
// Called when the active showcase changes. Those preferences reference a
// collection's own fields — including custom fields, which are per-collection —
// so a filter or sort saved while viewing one collection is meaningless in
// another and would be sent to the backend as an invalid condition (e.g. sorting
// by a "Release Year" custom field that the newly selected showcase doesn't
// define, which the search endpoint rejects with a 400). Clearing them on the
// switch lets each collection start from its own natural order.
export function clearPersistedCollectionViews(): void {
  if (typeof window === "undefined") return;
  try {
    // Collect first, then remove: mutating localStorage while iterating its
    // index would shift the remaining keys.
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith(FILTERS_STORAGE_PREFIX) ||
          key.startsWith(SORTS_STORAGE_PREFIX))
      ) {
        stale.push(key);
      }
    }
    for (const key of stale) localStorage.removeItem(key);
  } catch {
    // Best-effort: unavailable or blocked storage just means there's nothing to
    // clear.
  }
}
