"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BeginnerHint from "./BeginnerHint";
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
        <Link href="/options" {...navProps("/options")}>
          <OptionsIcon />
          Options
        </Link>
      </nav>

      <BeginnerHint
        className={styles.beginnerHint}
        text="Beginner mode is on, click on this symbol to learn more about the best ways to use the pensieve, turn beginner mode off on the options page."
      />

      <div className={styles.sideFoot}>A Seth Condie Project</div>
    </aside>
  );
}
