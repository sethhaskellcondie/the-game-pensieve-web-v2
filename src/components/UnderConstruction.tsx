import type { ReactNode } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import styles from "./UnderConstruction.module.css";

type UnderConstructionProps = {
  label: string;
  // The page's own icon (typically its Sidebar icon), shown in the Header mark
  // so the header matches the nav entry the user clicked to get here.
  icon: ReactNode;
};

export default function UnderConstruction({
  label,
  icon,
}: UnderConstructionProps) {
  const heading = `${label} is still being built`;

  return (
    <>
      <Header
        icon={icon}
        title="UNDER"
        titleAccent="CONSTRUCTION"
        tagline="This part of the Pensieve is still being built."
      >
        <div className={styles.badge}>
          <span className={styles.badgeDot} />
          Coming Soon
        </div>
      </Header>

      <main className={styles.content}>
        <div className={styles.ucWrap}>
          <div className={styles.ucBanner}>
            <div className={styles.panelIn}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M 19.76 8.79 L 22.85 10.19 L 22.85 13.81 L 19.76 15.21 L 20.95 18.40 L 18.40 20.95 L 15.21 19.76 L 13.81 22.85 L 10.19 22.85 L 8.79 19.76 L 5.60 20.95 L 3.05 18.40 L 4.24 15.21 L 1.15 13.81 L 1.15 10.19 L 4.24 8.79 L 3.05 5.60 L 5.60 3.05 L 8.79 4.24 L 10.19 1.15 L 13.81 1.15 L 15.21 4.24 L 18.40 3.05 L 20.95 5.60 L 19.76 8.79 Z M 15.40 12 A 3.4 3.4 0 1 0 8.60 12 A 3.4 3.4 0 1 0 15.40 12 Z"
                />
              </svg>
              <b>COMING SOON</b>
            </div>
          </div>

          <h2 className={styles.ucH2}>{heading}</h2>
          <p className={styles.ucP}>
            Pardon our dust! We&apos;re working on this — check back later for
            updates.
          </p>

          <div className={styles.ucActions}>
            <Link className={styles.ucBtn} href="/">
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
