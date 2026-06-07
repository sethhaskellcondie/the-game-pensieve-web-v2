import type { ReactNode } from "react";
import styles from "./Header.module.css";

type HeaderProps = {
  // The icon glyph only (e.g. an <svg> or <Image>). Header owns the mark's
  // white square and blue tint, so pages can't make the mark diverge.
  icon: ReactNode;
  title: string;
  titleAccent?: string;
  tagline: string;
  // Optional "flavor" slot rendered under the title block (stats, a badge, a
  // status pill, …). Composition keeps Header agnostic about what goes here.
  children?: ReactNode;
};

export default function Header({
  icon,
  title,
  titleAccent,
  tagline,
  children,
}: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.heroTop}>
        <div className={styles.heroMark}>{icon}</div>
        <div>
          <h1 className={styles.heroTitle}>
            {title}
            {titleAccent ? (
              <> <span className={styles.heroTitleEm}>{titleAccent}</span></>
            ) : null}
          </h1>
          <div className={styles.tag}>{tagline}</div>
        </div>
      </div>

      {children}
    </header>
  );
}
