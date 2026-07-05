"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "./SessionProvider";
import styles from "./ShowcaseBanner.module.css";

// Routes where the banner would be noise (the auth/marketing pages themselves).
const HIDDEN_PREFIXES = ["/login", "/signup", "/pricing"];

// The showcase context strip shown app-wide via the layout.
//
// Two states:
// - A showcase is selected (any viewer): "Viewing {name} (read-only)" with
//   *Back to my collection* (authenticated, clears the selection) or *Log in*
//   (anonymous). Not dismissible — it's the only always-visible indicator that
//   the data on screen isn't the viewer's own.
// - Anonymous with no selection: the default-showcase notice pointing at log in.
//   Dismissible, as before.
export default function ShowcaseBanner() {
  const { role, activeShowcase, selectShowcase, isAuthenticated } =
    useSession();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  if (activeShowcase) {
    return (
      <div
        className={styles.banner}
        role="status"
        aria-label="Showcase notice"
      >
        <span className={styles.text}>
          Viewing <strong>{activeShowcase.name}</strong> (read-only).{" "}
          {isAuthenticated ? (
            <>
              <button
                type="button"
                className={styles.leave}
                onClick={async () => {
                  setLeaving(true);
                  const ok = await selectShowcase(null);
                  if (!ok) setLeaving(false);
                }}
                disabled={leaving}
              >
                {leaving ? "Returning…" : "Back to my collection"}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={styles.link}>
                Log in
              </Link>{" "}
              to manage your own collection.
            </>
          )}
        </span>
      </div>
    );
  }

  if (role !== "guest" || dismissed) return null;

  return (
    <div className={styles.banner} role="status" aria-label="Showcase notice">
      <span className={styles.text}>
        You&rsquo;re viewing the public showcase.{" "}
        <Link href="/login" className={styles.link}>
          Log in
        </Link>{" "}
        to manage your own collection.
      </span>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss showcase notice"
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
    </div>
  );
}
