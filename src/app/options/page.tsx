import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import UiSettings from "@/components/UiSettings";
import DefaultSortSettings from "@/components/DefaultSortSettings";
import ApiHeartbeat from "@/components/ApiHeartbeat";
import BackupImport from "@/components/BackupImport";
import { OptionsIcon } from "@/components/icons";
import { readShowcaseSlug } from "@/lib/serverShowcase";
import { loadSessionView } from "@/lib/session";
import styles from "./options.module.css";

export const metadata: Metadata = {
  title: "Options · The Game Pensieve",
};

export default async function OptionsPage() {
  // Options manage the VIEWER's own settings and backups — not showcase data —
  // so the page (like its sidebar link) is unavailable in showcase mode.
  if (await readShowcaseSlug()) redirect("/");

  // Options require a logged-in account; guests have no settings or backups to
  // manage. This guards the route directly since the hidden nav link alone
  // wouldn't stop a guest navigating to /options by URL. On an unsecured
  // backend there are no accounts and the anonymous caller IS the collection's
  // owner, so the page (all of it — settings, sorts, API tools, backups) is
  // simply available.
  const { role, authMode } = await loadSessionView();
  if (authMode !== "unsecured" && role === "guest") redirect("/login");

  return (
    <>
      <Header
        icon={<OptionsIcon />}
        title="OPTIONS"
        tagline="Tune the interface and check your connection to external services."
      />

      <main className={styles.content}>
        <UiSettings />
        <DefaultSortSettings />
        <ApiHeartbeat />
        {/* Import/export is bulk data work — desktop-only by decision; the
            wrapper hides the whole section below the breakpoint. */}
        <div className={styles.desktopOnly}>
          <BackupImport />
        </div>
      </main>
    </>
  );
}
