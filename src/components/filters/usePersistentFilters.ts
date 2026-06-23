"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ActiveFilter } from "./types";
import { decodeFilterParam, encodeFilterParam } from "./urlFilters";

// A collection page's applied filters persist in localStorage so they survive a
// refresh or a navigate-away-and-back. This is a browser-only display preference
// (not shared backend state), so localStorage — mirroring usePersistentColumnWidths
// — rather than the ui_settings store. Serialization reuses the same encode/decode
// the `filters` URL param uses, so the stored shape matches a deep-link exactly.
const PREFIX = "filters:";

// The filters a page should load with: a non-empty `filters` URL param (a deep
// link from a home saved-filter card) wins; otherwise the last-used filters from
// storage. Computed synchronously so the initial data query can use it. SSR-safe:
// localStorage is read only in the browser, so this returns `initialFilters`
// during the server render (keeping the seeded state below hydration-clean).
function resolveInitialFilters(
  storageKey: string,
  initialFilters: ActiveFilter[],
): ActiveFilter[] {
  if (initialFilters.length > 0) return initialFilters;
  if (typeof window === "undefined") return initialFilters;
  try {
    const raw = localStorage.getItem(PREFIX + storageKey);
    if (raw) {
      const restored = decodeFilterParam(raw);
      if (restored.length > 0) return restored;
    }
  } catch {
    // Ignore unavailable/corrupt storage — fall back to the URL seed.
  }
  return initialFilters;
}

// Drop-in replacement for `useState<ActiveFilter[]>(initialFilters)` that also
// returns, as a third element, the resolved filters to load with (see below).
// `storageKey` namespaces the saved filters per page (e.g. "toy").
//
// State initializes from `initialFilters` (the decoded `filters` URL param) so the
// server render and the first client render match — no hydration mismatch. After
// mount: a non-empty URL param wins and becomes the new persisted set; otherwise
// the last-used filters are restored into the visible state. Every later change is
// persisted, so clearing the filters is remembered too.
//
// The third return value is the resolved set computed synchronously on the client
// (URL seed, or the stored filters). Callers seed their initial data query with it
// so the very first request is already filtered — the post-mount restore that
// swaps the visible state to match then doesn't trigger a redundant second query.
export function usePersistentFilters(
  storageKey: string,
  initialFilters: ActiveFilter[],
): [ActiveFilter[], Dispatch<SetStateAction<ActiveFilter[]>>, ActiveFilter[]] {
  // Resolve once via a lazy state init (the setter is intentionally unused): the
  // value and its identity stay stable across renders, so it's safe to use as an
  // effect dependency in the consuming component.
  const [resolved] = useState<ActiveFilter[]>(() =>
    resolveInitialFilters(storageKey, initialFilters),
  );

  const [filters, setFilters] = useState<ActiveFilter[]>(initialFilters);

  // Gate the persist effect so the initial render can't overwrite the saved
  // filters with the URL-seeded set before the restore effect has run.
  const loaded = useRef(false);

  useEffect(() => {
    try {
      if (initialFilters.length > 0) {
        // Deep-linked with filters: honor them and make them the persisted set.
        localStorage.setItem(
          PREFIX + storageKey,
          encodeFilterParam(initialFilters),
        );
      } else if (resolved.length > 0) {
        // Restored from storage: swap the SSR-safe seed for the saved filters.
        // The initial query already used `resolved`, so this doesn't refetch.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFilters(resolved);
      }
    } catch {
      // Ignore unavailable/corrupt storage — fall back to the URL-seeded filters.
    }
    loaded.current = true;
    // Mount-only: storageKey is stable per page, and both initialFilters (a memo)
    // and resolved (a ref) are stable for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist on every change, once the initial restore has run.
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(PREFIX + storageKey, encodeFilterParam(filters));
    } catch {
      // Ignore quota/private-mode failures — persistence is best-effort.
    }
  }, [storageKey, filters]);

  return [filters, setFilters, resolved];
}
