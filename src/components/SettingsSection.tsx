import type { ReactNode } from "react";
import styles from "./SettingsSection.module.css";

type SettingsSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
};

// Presentational wrapper for an Options page section: an accented heading with an
// inline description, followed by a card that holds the section's rows.
export default function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
      </div>
      <div className={styles.card}>{children}</div>
    </section>
  );
}
