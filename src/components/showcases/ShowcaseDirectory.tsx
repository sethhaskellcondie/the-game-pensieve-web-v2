"use client";

import { useState } from "react";
import Button from "@/components/Button";
import { useToast } from "@/components/ToastProvider";
import { useSession } from "@/components/auth/SessionProvider";
import type { ShowcaseDto } from "@/lib/api";
import styles from "./ShowcaseDirectory.module.css";

// The clickable body of the /showcases page. Renders the "home" entry (the
// viewer's own collection when logged in, the default showcase when anonymous)
// followed by every publicly visible showcase. Selecting posts through the
// session provider, which sets/clears the gp_showcase cookie and hard-navigates
// to "/" so all data re-renders under the new selection.
export default function ShowcaseDirectory({
  showcases,
  loadFailed,
}: {
  showcases: ShowcaseDto[];
  loadFailed: boolean;
}) {
  const { activeShowcase, isAuthenticated, selectShowcase } = useSession();
  const { showSnackbar } = useToast();
  // The slug (or "" for home) whose selection is in flight; null when idle.
  const [pending, setPending] = useState<string | null>(null);

  async function view(slug: string | null) {
    if (pending !== null) return;
    setPending(slug ?? "");
    const ok = await selectShowcase(slug);
    if (!ok) {
      setPending(null);
      showSnackbar({
        message: "Couldn't open that showcase. It may no longer be available.",
        variant: "error",
      });
    }
  }

  const homeName = isAuthenticated ? "My Collection" : "Default showcase";
  const homeNote = isAuthenticated
    ? "Your own collection — full access per your plan."
    : "The collection anonymous visitors see by default.";

  return (
    <ul className={styles.list} aria-label="Showcases">
      <li className={styles.row}>
        <div className={styles.info}>
          <span className={styles.name}>{homeName}</span>
          <span className={styles.note}>{homeNote}</span>
        </div>
        {activeShowcase ? (
          <Button
            onClick={() => view(null)}
            disabled={pending !== null}
            aria-busy={pending === ""}
          >
            {pending === "" ? "Opening…" : "View"}
          </Button>
        ) : (
          <span className={styles.current} aria-current="true">
            Currently viewing
          </span>
        )}
      </li>

      {showcases.map((showcase) => {
        const isActive = activeShowcase?.slug === showcase.slug;
        return (
          <li key={showcase.slug} className={styles.row}>
            <div className={styles.info}>
              <span className={styles.name}>{showcase.name}</span>
              <span className={styles.note}>Read-only public showcase</span>
            </div>
            {isActive ? (
              <span className={styles.current} aria-current="true">
                Currently viewing
              </span>
            ) : (
              <Button
                onClick={() => view(showcase.slug)}
                disabled={pending !== null}
                aria-busy={pending === showcase.slug}
              >
                {pending === showcase.slug ? "Opening…" : "View"}
              </Button>
            )}
          </li>
        );
      })}

      {showcases.length === 0 ? (
        <li className={styles.empty}>
          {loadFailed
            ? "The showcase directory couldn't be loaded. Try again in a moment."
            : "No public showcases are available right now."}
        </li>
      ) : null}
    </ul>
  );
}
