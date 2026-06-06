import type { ReactNode } from "react";
import styles from "./Header.module.css";

type HeaderProps = {
  icon: ReactNode;
  title: string;
  titleAccent: string;
  tagline: string;
  variant?: "default" | "construction";
  children?: ReactNode;
};

export default function Header({
  icon,
  title,
  titleAccent,
  tagline,
  variant = "default",
  children,
}: HeaderProps) {
  const isConstruction = variant === "construction";

  return (
    <header
      className={`${styles.header} ${isConstruction ? styles.construction : ""}`}
    >
      <div className={styles.heroTop}>
        <div
          className={`${styles.heroMark} ${isConstruction ? styles.markWarning : ""}`}
        >
          {icon}
        </div>
        <div>
          <h1 className={styles.heroTitle}>
            {title} <span className={styles.heroTitleEm}>{titleAccent}</span>
          </h1>
          <div className={styles.tag}>{tagline}</div>
        </div>
      </div>

      {children}
    </header>
  );
}
