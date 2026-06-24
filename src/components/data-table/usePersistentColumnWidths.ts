"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

// Per-page column widths persist in localStorage so a resize survives a refresh.
// This is a browser-only display preference (not shared backend state), hence
// localStorage rather than the ui_settings store.
const PREFIX = "colWidths:";

// Session-scoped in-memory cache of the latest widths, keyed by `storageKey`.
// Unlike localStorage, this is read synchronously during render, so a resize
// made earlier in the session is restored the instant the user navigates back
// to the page — without waiting on a post-mount effect that would otherwise
// flash the defaults and let a race overwrite the saved widths. It is seeded
// from localStorage on first load and kept in sync on every change.
//
// Safe to read during render: the cache is only ever written from effects, so
// it stays empty during SSR and on the first client render after a full page
// load (both render the defaults — no hydration mismatch); it is populated only
// later, within the same client session.
const sessionCache = new Map<string, Record<string, number>>();

// Test-only: drop the session cache so each test starts from a clean slate.
// In the real app the cache is intentionally long-lived (it's what persists
// widths across navigation for the session).
export function __resetColumnWidthSessionCache() {
  sessionCache.clear();
}

// Drop-in replacement for `useState<Record<string, number>>` of column widths.
// `storageKey` namespaces the saved widths per page (e.g. "systems"); pass
// `undefined` to opt out of persistence and keep plain in-memory behavior.
//
// State initializes from the column defaults (so the server render and the first
// client render match — no hydration mismatch), or from the session cache when
// it already holds this page's widths (navigating back within the session).
// Widths saved to localStorage in a previous session are merged in after mount.
export function usePersistentColumnWidths<K extends string>(
  storageKey: string | undefined,
  columns: { key: K; width: number }[],
): [Record<K, number>, Dispatch<SetStateAction<Record<K, number>>>] {
  const [widths, setWidths] = useState<Record<K, number>>(() => {
    const defaults = Object.fromEntries(
      columns.map((c) => [c.key, c.width]),
    ) as Record<K, number>;
    if (storageKey) {
      const cached = sessionCache.get(storageKey);
      if (cached) return { ...defaults, ...cached };
    }
    return defaults;
  });

  // Gate the persist effect so the initial render can't overwrite saved widths
  // with the defaults before the load effect has had a chance to merge them in.
  const loaded = useRef(false);

  // Load once after mount: when the session cache hasn't been seeded yet (first
  // visit this session), merge every saved numeric width from localStorage over
  // the defaults. Once the cache is seeded, render already restored it, so we
  // skip the read.
  //
  // We deliberately do NOT filter by the current columns here — custom-field
  // columns (`cf-<id>`) arrive asynchronously after their fetch, so they aren't
  // present in `columns` yet on mount. Filtering would drop their saved widths
  // before the columns exist. Unknown keys are harmless: the table only ever
  // reads `widths[column.key]` for columns it actually renders.
  useEffect(() => {
    if (!storageKey || sessionCache.has(storageKey)) {
      loaded.current = true;
      return;
    }
    try {
      const raw = localStorage.getItem(PREFIX + storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, unknown>;
        const merged: Partial<Record<K, number>> = {};
        for (const [key, value] of Object.entries(saved)) {
          if (typeof value === "number") {
            merged[key as K] = value;
          }
        }
        if (Object.keys(merged).length > 0) {
          // Intentional: render the SSR-safe defaults first, then merge the
          // saved widths in once after mount. Reading localStorage during render
          // (lazy init) would make the client's first render disagree with the
          // server's HTML and trip a hydration mismatch.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setWidths((w) => ({ ...w, ...merged }));
        }
      }
    } catch {
      // Ignore unavailable/corrupt storage — fall back to defaults.
    }
    loaded.current = true;
  }, [storageKey]);

  // Persist on every change, once the initial load has run: update the session
  // cache (survives navigation) and localStorage (survives refresh).
  useEffect(() => {
    if (!storageKey || !loaded.current) return;
    sessionCache.set(storageKey, widths);
    try {
      localStorage.setItem(PREFIX + storageKey, JSON.stringify(widths));
    } catch {
      // Ignore quota/private-mode failures — persistence is best-effort.
    }
  }, [storageKey, widths]);

  return [widths, setWidths];
}
