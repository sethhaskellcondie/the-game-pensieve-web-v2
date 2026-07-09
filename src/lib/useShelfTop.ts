"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useIsMobile } from "./useMediaQuery";

// useLayoutEffect warns during SSR ("does nothing on the server"). The dialogs
// that use this hook are client components that still render on the server, so
// fall back to useEffect there and use the layout effect (measure before paint,
// no flash) on the client.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Where a mobile "shelf" dialog should begin: the bottom edge of the page hero
// header, in viewport pixels. The mobile shell is a locked-height column
// ([nav bar] / [header] / [scrolling content]) — the header never scrolls, so
// its bottom is a stable offset we only need to re-measure on resize/rotate.
//
// Returns 0 above the breakpoint (desktop dialogs cover their own chrome) and
// until the first measurement lands. Callers feed the result into the
// `--shelf-top` custom property so the shelf clears the header while leaving it
// (and the app nav bar above it) visible.
export function useShelfTop(active: boolean): number {
  const isMobile = useIsMobile();
  const [top, setTop] = useState(0);

  // Layout effect so the offset is applied before the browser paints the
  // slide-in's first frame — otherwise the shelf would flash anchored at the
  // top of the viewport before snapping below the header.
  useIsomorphicLayoutEffect(() => {
    // Off-mobile the returned value is masked to 0 below, so there's no need to
    // reset state here — just skip measuring.
    if (!active || !isMobile) return;
    const measure = () => {
      // Exactly one <header> renders per page (the hero). The mobile nav bar and
      // banners above it are <div>s, so this resolves the hero specifically.
      const header = document.querySelector("header");
      setTop(header ? Math.round(header.getBoundingClientRect().bottom) : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, isMobile]);

  return isMobile ? top : 0;
}
