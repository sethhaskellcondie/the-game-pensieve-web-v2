"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "./SessionProvider";
import PlanBadge from "./PlanBadge";
import styles from "./AccountMenu.module.css";

// Sidebar account panel: shows the current plan, the signed-in email, and the
// relevant auth actions (log in/sign up for guests; log out — plus an upgrade
// nudge when lapsed or on a trial — for authenticated users).
export default function AccountMenu() {
  const router = useRouter();
  const { role, email, isAuthenticated, refresh } = useSession();
  // Lapsed accounts upgrade to regain write/filter; trials upgrade to unlock
  // import (and lock in before the window ends).
  const showUpgrade = role === "lapsed" || role === "trial";

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore — we clear client state regardless below
    }
    await refresh();
    router.push("/");
    router.refresh();
  }

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
