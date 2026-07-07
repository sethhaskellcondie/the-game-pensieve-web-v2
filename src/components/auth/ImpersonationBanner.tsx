"use client";

import { useState } from "react";
import { useSession } from "./SessionProvider";
import styles from "./ImpersonationBanner.module.css";

// Persistent banner shown app-wide while a real admin is acting as another user.
// It names the admin and the target (plus the effective role) and offers the one
// way back to admin tools: Stop. It keys off `isImpersonating` — NOT `isAdmin` —
// because the effective role while acting is the target's (often not admin), yet
// the Stop control must stay reachable regardless of that role.
export default function ImpersonationBanner() {
  const { isImpersonating, impersonatedEmail, email, role, stopImpersonating } =
    useSession();
  const [stopping, setStopping] = useState(false);

  if (!isImpersonating) return null;

  const onStop = async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await stopImpersonating();
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>
        You ({email ?? "admin"}) are viewing as{" "}
        <b className={styles.target}>{impersonatedEmail ?? "user"}</b> (
        {role.toUpperCase()}).
      </span>
      <button
        type="button"
        className={styles.stop}
        onClick={onStop}
        disabled={stopping}
      >
        {stopping ? "Stopping…" : "Stop impersonating"}
      </button>
    </div>
  );
}
