"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BeginnerHint from "./BeginnerHint";
import AccountMenu from "./auth/AccountMenu";
import { useSession } from "./auth/SessionProvider";
import styles from "./Sidebar.module.css";
import {
  VideoGamesIcon,
  BoardGamesIcon,
  ToysIcon,
  SystemsIcon,
  CustomFieldsIcon,
  OptionsIcon,
} from "./icons";

export default function Sidebar() {
  const pathname = usePathname();
  // While viewing a public showcase, Options (the VIEWER's own UI settings) is
  // hidden — it isn't part of the collection on screen. Custom Fields stays: a
  // showcase's fields are collection data, shown read-only like Systems and the
  // rest (write controls are gated on canWrite, which is false in showcase mode).
  // Options also requires a logged-in account — it manages the viewer's own
  // settings and backups, which a guest has none of.
  const { activeShowcase, isAuthenticated } = useSession();
  const showcaseMode = activeShowcase != null;

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
          <VideoGamesIcon />
          Video Games
        </Link>
        <Link href="/board-games" {...navProps("/board-games")}>
          <BoardGamesIcon />
          Board Games
        </Link>
        <Link href="/toys" {...navProps("/toys")}>
          <ToysIcon />
          Toys
        </Link>

        <div className={styles.grp}>Manage</div>
        <Link href="/systems" {...navProps("/systems")}>
          <SystemsIcon />
          Systems
        </Link>
        <Link href="/custom-fields" {...navProps("/custom-fields")}>
          <CustomFieldsIcon />
          Custom Fields
        </Link>
        {showcaseMode || !isAuthenticated ? null : (
          <Link href="/options" {...navProps("/options")}>
            <OptionsIcon />
            Options
          </Link>
        )}
      </nav>

      <BeginnerHint
        className={styles.beginnerHint}
        placement="top-start"
        text="Beginner mode is on, click on this symbol to learn more about the best ways to use the pensieve, turn beginner mode off on the options page."
      />

      <AccountMenu />

      <div className={styles.sideFoot}>A Seth Condie Project</div>
    </aside>
  );
}
