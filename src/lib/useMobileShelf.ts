"use client";

import type { CSSProperties } from "react";
import { useIsMobile, useMediaQuery } from "./useMediaQuery";
import { useShelfTop } from "./useShelfTop";
import { useShelfClose } from "./useShelfClose";

// One hook that turns any dialog into a mobile "shelf": below the breakpoint it
// slides in from the right, stops below the page header, and slides off to the
// left on dismissal. Above the breakpoint everything is inert — the dialog keeps
// its own desktop chrome and closes immediately.
//
// Usage (see the create modals and the filter/sort panels):
//   const { isMobile, requestClose, overlayStyle, slideStyle } = useMobileShelf();
//   ...
//   <div className={styles.backdrop} style={overlayStyle}
//        onMouseDown={() => requestClose(onClose)}>
//     <div className={styles.modal} style={slideStyle}> ... </div>
//   </div>
// Every close affordance (X, Cancel, backdrop, Escape) routes through
// requestClose so the slide-out plays before the caller's onClose unmounts it.
export function useMobileShelf(): {
  isMobile: boolean;
  closing: boolean;
  requestClose: (action: () => void) => void;
  // For the fixed overlay element: offsets it below the header on mobile.
  overlayStyle: CSSProperties | undefined;
  // For the sliding element: the in/out slide animation on mobile.
  slideStyle: CSSProperties | undefined;
} {
  const isMobile = useIsMobile();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const animate = isMobile && !reduceMotion;
  const top = useShelfTop(isMobile);
  const { closing, requestClose } = useShelfClose(animate);

  return {
    isMobile,
    closing,
    requestClose,
    overlayStyle: isMobile ? { top } : undefined,
    slideStyle: animate
      ? {
          animation: `${
            closing ? "shelf-slide-out" : "shelf-slide-in"
          } 0.2s ease${closing ? " forwards" : ""}`,
        }
      : undefined,
  };
}
