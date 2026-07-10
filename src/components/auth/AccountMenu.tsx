"use client";

import Link from "next/link";
import { useSession } from "./SessionProvider";
import { clearPersistedCollectionViews } from "@/components/filters/persistedViews";
import PlanBadge from "./PlanBadge";
import styles from "./AccountMenu.module.css";

// Sidebar account panel: shows the current plan, the signed-in email, and the
// relevant auth actions (log in/sign up for guests; log out — plus an upgrade
// nudge when lapsed or on a trial — for authenticated users). On an unsecured
// (personal, local) backend none of these concepts exist — no plans, accounts,
// or logins — so the panel renders nothing at all.
export default function AccountMenu() {
  const { role, email, isAuthenticated, authMode } = useSession();
  // Lapsed accounts upgrade to regain write/filter; trials upgrade to unlock
  // import (and lock in before the window ends).
  const showUpgrade = role === "lapsed" || role === "trial";

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore — we hard-navigate below regardless
    }
    // Logging out swaps the home context from the user's own collection to the
    // default public showcase, which has its own fields — drop the previous
    // session's persisted filters/sorts so a stale custom-field condition isn't
    // reapplied against a collection that lacks that field.
    clearPersistedCollectionViews();
    // Full navigation (not router.refresh): every server component must
    // re-render as a guest so the home page reloads the default showcase's
    // metadata (ui_settings, sort options) and filters (saved filters, custom
    // fields) cleanly.
    window.location.assign("/");
  }

  if (authMode === "unsecured") return null;

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <span className={styles.planLabel}>Plan</span>
        <PlanBadge role={role} />
      </div>

      {isAuthenticated && email ? (
        <p className={styles.email} title={email}>
          {email}
        </p>
      ) : null}

      <div className={styles.actions}>
        {isAuthenticated ? (
          <>
            {showUpgrade ? (
              <Link href="/pricing" className={styles.upgrade}>
                Upgrade
              </Link>
            ) : null}
            <Link href="/account" className={styles.link}>
              Account
            </Link>
            <button type="button" className={styles.link} onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          <>
            {/* The login page now hosts both sign-in and sign-up, so a single
                entry point covers both. */}
            <Link href="/login" className={styles.link}>
              Log in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
