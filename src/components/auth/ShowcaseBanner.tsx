"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "./SessionProvider";
import styles from "./ShowcaseBanner.module.css";

// Routes where the banner would be noise (the auth/marketing pages themselves).
const HIDDEN_PREFIXES = ["/login", "/signup", "/pricing"];

// Tells anonymous visitors they're browsing the public showcase (read + filter
// only) and points them to log in for their own collection. Shown app-wide for
// guests via the layout; hidden on the auth/pricing pages and once dismissed.
export default function ShowcaseBanner() {
  const { role } = useSession();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  if (role !== "guest" || dismissed) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <div className={styles.banner} role="status">
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
