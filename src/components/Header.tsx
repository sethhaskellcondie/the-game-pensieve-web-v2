import type { ReactNode } from "react";
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
  return (
    <header className={styles.header}>
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
    </header>
  );
}
