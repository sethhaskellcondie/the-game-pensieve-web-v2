import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Under Construction · The Game Pensieve",
};

export default function UnderConstruction() {
  return (
    <>
      <Header
        variant="construction"
        badge="Coming Soon"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 12l-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9" />
            <path d="M17.64 15 22 10.64" />
            <path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h.86c.85 0 1.65.34 2.25.93l1.25 1.25" />
          </svg>
        }
        title="UNDER"
        titleAccent="CONSTRUCTION"
        tagline="This part of the Pensieve is still being built."
      />

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

          <h2 className={styles.ucH2}>This page is still being built</h2>
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
