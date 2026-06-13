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

// Drop-in replacement for `useState<Record<string, number>>` of column widths.
// `storageKey` namespaces the saved widths per page (e.g. "systems"); pass
// `undefined` to opt out of persistence and keep plain in-memory behavior.
//
// State always initializes from the column defaults so the server render and the
// first client render match (no hydration mismatch); saved widths are merged in
// from localStorage after mount.
export function usePersistentColumnWidths<K extends string>(
  storageKey: string | undefined,
  columns: { key: K; width: number }[],
): [Record<K, number>, Dispatch<SetStateAction<Record<K, number>>>] {
  const [widths, setWidths] = useState<Record<K, number>>(
    () =>
      Object.fromEntries(columns.map((c) => [c.key, c.width])) as Record<
        K,
        number
      >,
  );

  // Gate the persist effect so the initial render can't overwrite saved widths
  // with the defaults before the load effect has had a chance to merge them in.
  const loaded = useRef(false);

  // Load once after mount: merge every saved numeric width over the defaults.
  // We deliberately do NOT filter by the current columns here — custom-field
  // columns (`cf-<id>`) arrive asynchronously after their fetch, so they aren't
  // present in `columns` yet on mount. Filtering would drop their saved widths
  // before the columns exist. Unknown keys are harmless: the table only ever
  // reads `widths[column.key]` for columns it actually renders.
  useEffect(() => {
    if (!storageKey) return;
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

  // Persist on every change, once the initial load has run.
  useEffect(() => {
    if (!storageKey || !loaded.current) return;
    try {
      localStorage.setItem(PREFIX + storageKey, JSON.stringify(widths));
    } catch {
      // Ignore quota/private-mode failures — persistence is best-effort.
    }
  }, [storageKey, widths]);

  return [widths, setWidths];
}
