import type { Metadata } from "next";
import ShowcaseDirectory from "@/components/showcases/ShowcaseDirectory";
import { listShowcases, type ShowcaseDto } from "@/lib/api";
import styles from "./showcases.module.css";

export const metadata: Metadata = {
  title: "Showcases · The Game Pensieve",
};

// The public showcase directory: every collection whose owner currently shares
// it. Server component — the list is fetched here so it renders on first
// paint; the per-row View actions are client-side (they set the selection
// cookie and re-enter the app at "/").
export default async function ShowcasesPage() {
  let showcases: ShowcaseDto[] = [];
  let loadFailed = false;
  try {
    showcases = await listShowcases();
  } catch {
    loadFailed = true;
  }

  return (
    <main className={styles.content}>
      <h1>Public showcases</h1>
      <p className={styles.lede}>
        Browse collections that other collectors have made public. Viewing a
        showcase is read-only — you can look around and filter, but nothing can
        be changed.
      </p>

      <ShowcaseDirectory showcases={showcases} loadFailed={loadFailed} />
    </main>
  );
}
