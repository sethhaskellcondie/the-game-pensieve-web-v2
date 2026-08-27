import type { Metadata } from "next";
import { SystemsIcon } from "@/components/icons";
import Header from "@/components/Header";
import SystemsManager from "@/components/systems/SystemsManager";
import styles from "./systems.module.css";

export const metadata: Metadata = {
  title: "Systems · The Game Pensieve",
};

export default async function SystemsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Pre-applied filters and sort levels from a home saved-filter card, if any.
  const resolvedParams = await searchParams;
  const initialFiltersParam = resolvedParams.filters;
  const initialSortsParam = resolvedParams.sorts;

  return (
    <>
      <Header
        icon={<SystemsIcon />}
        title="SYSTEMS"
        tagline="All of your systems and their data in one place!"
        beginnerHint="Many video game collections are organized by system, manage all of the systems for any game in your collection here."
      />

      <main className={styles.content}>
        <SystemsManager
          initialFiltersParam={initialFiltersParam}
          initialSortsParam={initialSortsParam}
        />
      </main>
    </>
  );
}
