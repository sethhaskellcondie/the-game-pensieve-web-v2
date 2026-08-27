"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { SORTS_STORAGE_PREFIX } from "./persistedViews";
import type { ActiveSort } from "./types";
import { decodeSortParam, encodeSortParam } from "./urlFilters";

// A collection page's applied sort levels persist in localStorage so they survive
// a refresh or a navigate-away-and-back — mirroring usePersistentFilters. Sorting
// is a browser-only display preference (the per-entity *default* sort lives in the
// backend ui store; this is only the page's own override), so localStorage is the
// right home. Keyed per page (e.g. "sorts:toy") so each collection remembers its
// own sort independently. The prefix is shared so a showcase switch can clear
// these keys (see clearPersistedCollectionViews). Serialization reuses the same
// encode/decode the `sorts` URL param uses, so the stored shape matches a deep
// link exactly.
const PREFIX = SORTS_STORAGE_PREFIX;

// The sort levels a page should load with: a non-empty `sorts` URL param (a deep
// link from a home saved-filter card) wins; otherwise the last-used sorts from
// storage. Computed synchronously so the initial data query can seed itself with
// them. SSR-safe: localStorage is read only in the browser, so this returns
// `initialSorts` during the server render (keeping the seeded state below
// hydration-clean).
function resolveInitialSorts(
  storageKey: string,
  initialSorts: ActiveSort[],
): ActiveSort[] {
  if (initialSorts.length > 0) return initialSorts;
  if (typeof window === "undefined") return initialSorts;
  try {
    const raw = localStorage.getItem(PREFIX + storageKey);
    if (raw) {
      const restored = decodeSortParam(raw);
      if (restored.length > 0) return restored;
    }
  } catch {
    // Ignore unavailable/corrupt storage — fall back to the URL seed.
  }
  return initialSorts;
}

// Drop-in replacement for `useState<ActiveSort[]>(initialSorts)` that also
// persists the page's sort levels to localStorage and restores them on the next
// visit, and returns the resolved sorts as a third element. `storageKey`
// namespaces the saved sorts per page (e.g. "toy").
//
// State initializes from `initialSorts` (the decoded `sorts` URL param) so the
// server render and the first client render match — no hydration mismatch. After
// mount: a non-empty URL param wins and becomes the new persisted set; otherwise
// the stored sorts are restored into the visible state. Every later change is
// persisted, so clearing the sort (back to the entity default) is remembered too.
//
// The third return value is the resolved set computed synchronously on the
// client (URL seed, or the stored sorts). Callers seed their initial data query
// with it (via sortsOrDefault) so the very first request already carries the
// restored sort — the post-mount restore that swaps the visible state to match
// then doesn't trigger a redundant second query.
export function usePersistentSorts(
  storageKey: string,
  initialSorts: ActiveSort[] = [],
): [ActiveSort[], Dispatch<SetStateAction<ActiveSort[]>>, ActiveSort[]] {
  // Resolve once via a lazy state init (the setter is intentionally unused): the
  // value and its identity stay stable across renders, so it's safe to use as an
  // effect dependency in the consuming component.
  const [resolved] = useState<ActiveSort[]>(() =>
    resolveInitialSorts(storageKey, initialSorts),
  );

  const [sorts, setSorts] = useState<ActiveSort[]>(initialSorts);

  // Gate the persist effect so the initial render can't overwrite the saved sorts
  // with the seeded set before the restore effect has run.
  const loaded = useRef(false);

  useEffect(() => {
    try {
      if (initialSorts.length > 0) {
        // Deep-linked with sorts: honor them and make them the persisted set.
        localStorage.setItem(PREFIX + storageKey, encodeSortParam(initialSorts));
      } else if (resolved.length > 0) {
        // Restored from storage: swap the SSR-safe empty seed for the saved
        // sorts. The initial query already used `resolved`, so this doesn't
        // refetch.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSorts(resolved);
      }
    } catch {
      // Ignore unavailable/corrupt storage — fall back to the URL-seeded sorts.
    }
    loaded.current = true;
    // Mount-only: storageKey is stable per page, and both initialSorts (a memo)
    // and resolved (a ref) are stable for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist on every change, once the initial restore has run.
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(PREFIX + storageKey, encodeSortParam(sorts));
    } catch {
      // Ignore quota/private-mode failures — persistence is best-effort.
    }
  }, [storageKey, sorts]);

  return [sorts, setSorts, resolved];
}
