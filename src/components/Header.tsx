"use client";

import type { ReactNode } from "react";
import BeginnerHint from "./BeginnerHint";
import { useUiSettings } from "./UiSettingsProvider";
import styles from "./Header.module.css";

type HeaderProps = {
  icon: ReactNode;
  title: string;
  titleAccent?: string;
  tagline: string;
  // Page-specific guidance shown as a BeginnerHint in the hero row (only
  // while beginner mode is on).
  beginnerHint?: string;
  // Controls that belong on the hero row itself, pinned to its right edge —
  // e.g. the collection pages' List/Shelf toggle. Rendered as a flex sibling of
  // the title block (rather than floated over it) so a long title or tagline
  // wraps beside the controls instead of running underneath them.
  heroAside?: ReactNode;
  children?: ReactNode;
};

export default function Header({
  icon,
  title,
  titleAccent,
  tagline,
  beginnerHint,
  heroAside,
  children,
}: HeaderProps) {
  // The animated grid/wash/glow background can be parked on a static frame via
  // the "Hide Animations" UI setting. The hook's safe defaults keep this usable
  // (animated) when rendered without a provider.
  const { settings } = useUiSettings();

  return (
    <header className={styles.header} data-static={settings.hideAnimations}>
      <div className={styles.bg}>
        <div className={styles.grid} />
        <div className={styles.wash} />
        <div className={styles.glow} />
      </div>
      <div className={styles.content}>
        <div className={styles.heroTop}>
          <div className={styles.heroMark}>{icon}</div>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>
              {title}
              {titleAccent ? (<> <span className={styles.heroTitleEm}>{titleAccent}</span></>) : null}
            </h1>
            <div className={styles.tag}>{tagline}</div>
          </div>
          {beginnerHint ? (
            <BeginnerHint
              className={styles.headerHint}
              text={beginnerHint}
              placement="bottom-end"
            />
          ) : null}
          {heroAside ? <div className={styles.heroAside}>{heroAside}</div> : null}
        </div>
        {children}
      </div>
    </header>
  );
}
