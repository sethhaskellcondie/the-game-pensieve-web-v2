import type { Metadata } from "next";
import { SystemsIcon } from "@/components/icons";
import Header from "@/components/Header";
import SystemsManager from "@/components/systems/SystemsManager";
import styles from "./systems.module.css";

export const metadata: Metadata = {
  title: "Systems · The Game Pensieve",
};

export default function SystemsPage() {
  return (
    <>
      <Header
        icon={<SystemsIcon />}
        title="SYSTEMS"
        tagline="All of your systems and their data in one place!"
      />

      <main className={styles.content}>
        <SystemsManager />
      </main>
    </>
  );
}
