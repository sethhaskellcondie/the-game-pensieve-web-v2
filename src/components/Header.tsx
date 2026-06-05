import type { ReactNode } from "react";
import styles from "./Header.module.css";

type Stat = { value: string; label: string };

type HeaderProps = {
  icon: ReactNode;
  title: string;
  titleAccent: string;
  tagline: string;
  variant?: "default" | "construction";
  badge?: string;
  stats?: Stat[];
};

export default function Header({
  icon,
  title,
  titleAccent,
  tagline,
  variant = "default",
  badge,
  stats,
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
          {badge && (
            <div className={styles.badge}>
              <span className={styles.badgeDot} />
              {badge}
            </div>
          )}
          <h1 className={styles.heroTitle}>
            {title} <span className={styles.heroTitleEm}>{titleAccent}</span>
          </h1>
          <div className={styles.tag}>{tagline}</div>
        </div>
      </div>

      {stats && (
        <div className={styles.stats}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <b>{stat.value}</b>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
