"use client";

import { useEffect, useState } from "react";
import Listbox, { type ListboxOption } from "@/components/filters/Listbox";
import { useToast } from "@/components/ToastProvider";
import type { ShowcaseDto } from "@/lib/api";
import { useSession } from "./SessionProvider";
import styles from "./ShowcaseSwitcher.module.css";

// The "home" option: no showcase selected — an authenticated user's own
// collection, or the backend's default showcase for anonymous visitors.
const HOME = "";

// Dropdown for switching which public showcase is being viewed. Lives in the
// Showcase section of the account page. Selection posts to
// /api/showcase/select (via the session provider) and performs a full
// navigation to "/" so all server-rendered data re-fetches under the new cookie.
export default function ShowcaseSwitcher() {
  const { activeShowcase, isAuthenticated, selectShowcase } = useSession();
  const { showSnackbar } = useToast();
  const [entries, setEntries] = useState<ShowcaseDto[]>([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/showcases", { cache: "no-store" });
        if (!active || !res.ok) return;
        const body = (await res.json()) as { data?: ShowcaseDto[] };
        if (active && body.data) setEntries(body.data);
      } catch {
        // Directory unavailable: the switcher still offers the home option and
        // the current selection.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const options: ListboxOption[] = [
    { value: HOME, label: isAuthenticated ? "My Collection" : "Default showcase" },
    ...entries.map((s) => ({ value: s.slug, label: s.name })),
  ];
  // Keep the active selection visible even if the directory fetch failed (or
  // the slug just went dark — the stale-cookie path will clear it shortly).
  if (
    activeShowcase &&
    !entries.some((s) => s.slug === activeShowcase.slug)
  ) {
    options.push({ value: activeShowcase.slug, label: activeShowcase.name });
  }

  const current = activeShowcase?.slug ?? HOME;

  async function change(value: string) {
    if (value === current || switching) return;
    setSwitching(true);
    const ok = await selectShowcase(value === HOME ? null : value);
    if (!ok) {
      setSwitching(false);
      showSnackbar({
        message: "Couldn't switch showcases. It may no longer be available.",
        variant: "error",
      });
    }
    // On success the provider hard-navigates to "/" — no state to restore.
  }

  return (
    <div className={styles.wrap}>
      <Listbox
        value={current}
        options={options}
        onChange={change}
        ariaLabel="Switch showcase"
      />
    </div>
  );
}
