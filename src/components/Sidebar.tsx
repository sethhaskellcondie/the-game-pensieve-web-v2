"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

export default function Sidebar() {
  const pathname = usePathname();

  // Marks a nav link active when it matches the current URL, via both a style
  // hook and aria-current so the state is exposed to assistive tech.
  const navProps = (href: string) => {
    const isActive = pathname === href;
    return {
      className: isActive ? styles.active : undefined,
      "aria-current": isActive ? ("page" as const) : undefined,
    };
  };

  return (
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand}>
        <Image
          className={styles.brandLogo}
          src="/blue_pensieve.svg"
          alt="Pensieve"
          width={54}
          height={54}
        />
        <div className={styles.brandText}>
          THE GAME
          <br />
          <span className={styles.brandAccent}>PENSIEVE</span>
        </div>
      </Link>

      <nav className={styles.nav}>
        <div className={styles.grp}>Collections</div>
        <Link href="/video-games" {...navProps("/video-games")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="13" rx="2" />
            <path d="M8 21h8" />
          </svg>
          Video Games
        </Link>
        <Link href="/board-games" {...navProps("/board-games")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l9 5-9 5-9-5 9-5z" />
            <path d="M3 13l9 5 9-5" />
          </svg>
          Board Games
        </Link>
        <Link href="/toys" {...navProps("/toys")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M5 21v-2a5 5 0 0110 0v2" />
          </svg>
          Toys
        </Link>

        <div className={styles.grp}>Manage</div>
        <Link href="/systems" {...navProps("/systems")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="5" width="14" height="14" rx="2" />
            <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
          </svg>
          Systems
        </Link>
        <Link href="/custom-fields" {...navProps("/custom-fields")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 4l6 6M3 21l3-1 11-11-2-2L4 18l-1 3z" />
          </svg>
          Custom Fields
        </Link>
        <Link href="/options" {...navProps("/options")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" />
            <circle cx="9" cy="7" r="2" fill="currentColor" />
            <circle cx="15" cy="17" r="2" fill="currentColor" />
          </svg>
          Options
        </Link>
      </nav>

      <div className={styles.sideFoot}>A Seth Condie Project</div>
    </aside>
  );
}
