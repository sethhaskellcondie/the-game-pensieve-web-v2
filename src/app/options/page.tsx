import type { Metadata } from "next";
import Header from "@/components/Header";
import UiSettings from "@/components/UiSettings";
import ApiHeartbeat from "@/components/ApiHeartbeat";
import BackupImport from "@/components/BackupImport";
import { OptionsIcon } from "@/components/icons";
import styles from "./options.module.css";

export const metadata: Metadata = {
  title: "Options · The Game Pensieve",
};

export default function OptionsPage() {
  return (
    <>
      <Header
        icon={<OptionsIcon />}
        title="OPTIONS"
        tagline="Tune the interface and check your connection to external services."
      />

      <main className={styles.content}>
        <UiSettings />
        <ApiHeartbeat />
        <BackupImport />
      </main>
    </>
  );
}
