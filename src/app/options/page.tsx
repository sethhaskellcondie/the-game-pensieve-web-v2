import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import UiSettings from "@/components/UiSettings";
import DefaultSortSettings from "@/components/DefaultSortSettings";
import ApiHeartbeat from "@/components/ApiHeartbeat";
import BackupImport from "@/components/BackupImport";
import { OptionsIcon } from "@/components/icons";
import { readShowcaseSlug } from "@/lib/serverShowcase";
import styles from "./options.module.css";

export const metadata: Metadata = {
  title: "Options · The Game Pensieve",
};

export default async function OptionsPage() {
  // Options manage the VIEWER's own settings and backups — not showcase data —
  // so the page (like its sidebar link) is unavailable in showcase mode.
  if (await readShowcaseSlug()) redirect("/");

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
        <BackupImport />
      </main>
    </>
  );
}
