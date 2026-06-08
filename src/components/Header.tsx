"use client";

import type { ReactNode } from "react";
import { useUiSettings } from "./UiSettingsProvider";
import styles from "./Header.module.css";

type HeaderProps = {
  icon: ReactNode;
  title: string;
  titleAccent?: string;
  tagline: string;
  children?: ReactNode; //optional child component also included in the header
};

export default function Header({
  icon,
  title,
  titleAccent,
  tagline,
  children,
}: HeaderProps) {
  // The animated grid/wash/glow background can be parked on a static frame via
  // the "Hide Animations" UI setting. The hook's safe defaults keep this usable
  // (animated) when rendered without a provider.
  const { settings } = useUiSettings();

  return (
    <header className={styles.header} data-static={settings.hideAnimations}>
      <div className={styles.grid} />
      <div className={styles.wash} />
      <div className={styles.glow} />
      <div className={styles.content}>
        <div className={styles.heroTop}>
          <div className={styles.heroMark}>{icon}</div>
          <div>
            <h1 className={styles.heroTitle}>
              {title}
              {titleAccent ? (<> <span className={styles.heroTitleEm}>{titleAccent}</span></>) : null}
            </h1>
            <div className={styles.tag}>{tagline}</div>
          </div>
        </div>
        {children}
      </div>
    </header>
  );
}
