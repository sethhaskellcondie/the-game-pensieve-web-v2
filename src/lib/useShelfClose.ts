"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Duration of the shelf slide-out, in ms. Kept a touch longer than the CSS
// animation (200ms) so the element is fully off-screen before it unmounts. Also
// the fallback delay when no animationend arrives (e.g. reduced motion).
const EXIT_MS = 220;

// Drives the "slide off to the right, then close" exit for a mobile shelf dialog.
//
// Callers request a close through `requestClose(action)`, where `action` is what
// should ultimately run (usually the parent's onClose, or an apply-then-close).
// When `enabled` (mobile, motion allowed) the shelf is flagged `closing` — the
// caller swaps to the slide-out animation — and `action` runs after the slide
// completes. When disabled (desktop, or reduced motion) `action` runs at once,
// so nothing waits on an animation that won't play.
export function useShelfClose(enabled: boolean): {
  closing: boolean;
  requestClose: (action: () => void) => void;
} {
  const [closing, setClosing] = useState(false);
  const actionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      const action = actionRef.current;
      actionRef.current = null;
      // Reset before running the action so a dialog that stays mounted (e.g. the
      // filter/sort panels, which only toggle an `open` flag) is ready for its
      // next open rather than stuck in the closing state. Order matters: reset
      // first, since the action may unmount this component.
      setClosing(false);
      action?.();
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  const requestClose = useCallback(
    (action: () => void) => {
      if (!enabled) {
        action();
        return;
      }
      actionRef.current = action;
      setClosing(true);
    },
    [enabled],
  );

  return { closing, requestClose };
}
