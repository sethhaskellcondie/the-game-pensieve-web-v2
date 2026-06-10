import type { Metadata } from "next";
import Link from "next/link";
import { ToysIcon } from "@/components/icons";
import { ChevronLeftIcon } from "@/components/custom-fields/icons";
import Header from "@/components/Header";
import styles from "./toyDetails.module.css";

export const metadata: Metadata = {
  title: "Toy Details · The Game Pensieve",
};

// The toy detail page is intentionally blank for now — it carries the shared
// Header (so it reads as part of the Toys area) and a back link to the list.
// The toy's data + fields will be filled in here in a follow-up.
export default function ToyDetailsPage() {
  return (
    <>
      <Header
        icon={<ToysIcon />}
        title="TOYS"
        tagline="All of your toys and their data in one place!"
      />

      <main className={styles.content}>
        <Link href="/toys" className={styles.back}>
          <ChevronLeftIcon aria-hidden="true" /> Back to Toys
        </Link>
      </main>
    </>
  );
}
