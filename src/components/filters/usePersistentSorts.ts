"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { newFilterId } from "./ids";
import type { ActiveSort, SortDirection } from "./types";

// A collection page's applied sort levels persist in localStorage so they survive
// a refresh or a navigate-away-and-back — mirroring usePersistentFilters. Sorting
// is a browser-only display preference (the per-entity *default* sort lives in the
// backend ui store; this is only the page's own override), so localStorage is the
// right home. Keyed per page (e.g. "sorts:toy") so each collection remembers its
// own sort independently.
const PREFIX = "sorts:";

// The minimal per-level shape stored: enough to rebuild the chip and the sort
// request. The UI-local id is dropped (regenerated on restore) and the label is
// snapshotted the same way ActiveFilter does, so a renamed field still reads.
function encodeSorts(sorts: ActiveSort[]): string {
  return JSON.stringify(
    sorts.map((s) => ({
      field: s.field,
      label: s.label,
      direction: s.direction,
    })),
  );
}

// Decode stored sort levels. Defensive: a malformed value or any level missing a
// field / valid direction is dropped, so corrupt storage degrades to "no sorts"
// rather than throwing. Ids are freshly minted (they're only for React keys and
// edit/remove targeting, never persisted).
function decodeSorts(raw: string): ActiveSort[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: ActiveSort[] = [];
  for (const level of parsed) {
    if (typeof level !== "object" || level === null) continue;
    const { field, label, direction } = level as Record<string, unknown>;
    if (typeof field !== "string") continue;
    if (direction !== "asc" && direction !== "desc") continue;
    out.push({
      id: newFilterId(),
      field,
      label: typeof label === "string" ? label : field,
      direction: direction as SortDirection,
    });
  }
  return out;
}

// The sort levels a page should load with: the last-used sorts from storage.
// Computed synchronously so the initial data query can seed itself with them.
// SSR-safe: localStorage is read only in the browser, so this returns [] during
// the server render (keeping the seeded state below hydration-clean).
function resolveInitialSorts(storageKey: string): ActiveSort[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PREFIX + storageKey);
    if (raw) return decodeSorts(raw);
  } catch {
    // Ignore unavailable/corrupt storage — fall back to no sorts.
  }
  return [];
}

// Drop-in replacement for `useState<ActiveSort[]>([])` that also persists the
// page's sort levels to localStorage and restores them on the next visit, and
// returns the resolved sorts as a third element. `storageKey` namespaces the
// saved sorts per page (e.g. "toy").
//
// State initializes to [] so the server render and the first client render match
// — no hydration mismatch. After mount the stored sorts are restored into the
// visible state. Every later change is persisted, so clearing the sort (back to
// the entity default) is remembered too.
//
// The third return value is the resolved set computed synchronously on the
// client. Callers seed their initial data query with it (via sortsOrDefault) so
// the very first request already carries the restored sort — the post-mount
// restore that swaps the visible state to match then doesn't trigger a redundant
// second query.
export function usePersistentSorts(
  storageKey: string,
): [ActiveSort[], Dispatch<SetStateAction<ActiveSort[]>>, ActiveSort[]] {
  // Resolve once via a lazy state init (the setter is intentionally unused): the
  // value and its identity stay stable across renders, so it's safe to use as an
  // effect dependency in the consuming component.
  const [resolved] = useState<ActiveSort[]>(() =>
    resolveInitialSorts(storageKey),
  );

  const [sorts, setSorts] = useState<ActiveSort[]>([]);

  // Gate the persist effect so the initial render can't overwrite the saved sorts
  // with the empty seed before the restore effect has run.
  const loaded = useRef(false);

  useEffect(() => {
    if (resolved.length > 0) {
      // Restored from storage: swap the SSR-safe empty seed for the saved sorts.
      // The initial query already used `resolved`, so this doesn't refetch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSorts(resolved);
    }
    loaded.current = true;
    // Mount-only: storageKey is stable per page, and resolved (a ref) is stable
    // for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist on every change, once the initial restore has run.
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(PREFIX + storageKey, encodeSorts(sorts));
    } catch {
      // Ignore quota/private-mode failures — persistence is best-effort.
    }
  }, [storageKey, sorts]);

  return [sorts, setSorts, resolved];
}
