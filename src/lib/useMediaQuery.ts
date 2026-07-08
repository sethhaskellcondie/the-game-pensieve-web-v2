"use client";

import { useCallback, useSyncExternalStore } from "react";

// Single source of truth for the responsive breakpoint: below this width the
// app renders its mobile variants (see localFiles/adaptive_rollout.md). CSS
// modules can't read TS constants, so width media queries hard-code the same
// value — keep `@media (max-width: 767px)` rules in sync with this number.
export const MOBILE_BREAKPOINT = 768;

export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

// Subscribes to a CSS media query and re-renders when it flips.
//
// SSR-safe: the server (and therefore the hydration render) can't know the
// viewport, so the server snapshot reports `false` — desktop-first, matching
// the app's default layout. The client corrects immediately after hydration.
// Same defaults-first-then-correct pattern as usePersistentColumnWidths.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// True below MOBILE_BREAKPOINT. Components with an adaptive mobile variant
// branch on this; purely cosmetic adjustments should use CSS media queries
// instead so they don't pay for a client-side subscription.
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_MEDIA_QUERY);
}
