"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SidebarContent } from "./Sidebar";
import styles from "./MobileNav.module.css";

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

// Mobile shell navigation: below the
// 768px breakpoint the sidebar rail is hidden and this top bar takes over,
// exposing the same SidebarContent through a slide-in drawer. Rendered
// unconditionally and shown/hidden purely in CSS so the server render never
// depends on the viewport (no hydration mismatch, no flash of the wrong nav).
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // MobileNav lives in the root layout, so it survives client-side navigation;
  // the drawer must close itself (link clicks below) rather than rely on a
  // remount. Escape also closes, returning focus to the menu button.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Move focus into the drawer when it opens so keyboard/screen-reader users
  // land on the nav they just revealed.
  useEffect(() => {
    if (open) drawerRef.current?.focus();
  }, [open]);

  return (
    <div className={styles.mobileNav}>
      <div className={styles.topBar}>
        <Link href="/" className={styles.brand}>
          <Image
            className={styles.brandLogo}
            src="/blue_pensieve.svg"
            alt="Pensieve"
            width={36}
            height={36}
          />
          <span className={styles.brandText}>
            THE GAME <span className={styles.brandAccent}>PENSIEVE</span>
          </span>
        </Link>
        <button
          ref={menuButtonRef}
          type="button"
          className={styles.menuButton}
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="mobile-nav-drawer"
          onClick={() => setOpen((o) => !o)}
        >
          <HamburgerIcon />
        </button>
      </div>

      <div
        className={styles.backdrop}
        hidden={!open}
        onClick={() => setOpen(false)}
      />
      <div
        ref={drawerRef}
        id="mobile-nav-drawer"
        className={styles.drawer}
        hidden={!open}
        tabIndex={-1}
        // Any navigation from the drawer (nav links, account links, brand)
        // should dismiss it — delegate instead of threading a callback into
        // SidebarContent and every link it renders.
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        {/* Mounted only while open: a closed drawer must not duplicate the
            sidebar's links/account panel in the DOM — hidden duplicates still
            resolve in queries (Playwright strict mode, aria queries) and would
            break every test that targets the visible copy. */}
        {open ? <SidebarContent /> : null}
      </div>
    </div>
  );
}
