import type { Metadata } from "next";
import { ToysIcon } from "@/components/icons";
import Header from "@/components/Header";
import ToysManager from "@/components/toys/ToysManager";
import styles from "./toys.module.css";

export const metadata: Metadata = {
  title: "Toys · The Game Pensieve",
};

export default function ToysPage() {
  return (
    <>
      <Header
        icon={<ToysIcon />}
        title="TOYS AND "
        titleAccent="ACCESSORIES"
        tagline="Toys, controllers, additional peripherals and everything else!"
      />

      <main className={styles.content}>
        <ToysManager />
      </main>
    </>
  );
}
