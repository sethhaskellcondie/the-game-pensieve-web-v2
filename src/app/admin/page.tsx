import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import UsersManager from "@/components/admin/UsersManager";
import { AdminIcon } from "@/components/icons";
import { loadSessionView } from "@/lib/session";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: "Admin · The Game Pensieve",
};

// Admin-only area for managing user roles. Gated here by the caller's resolved
// role (the backend re-checks on every /v1/admin call), so a non-admin who
// guesses the URL gets a 404 rather than a peek at the page shell.
export default async function AdminPage() {
  const { role } = await loadSessionView();
  if (role !== "admin") notFound();

  return (
    <>
      <Header
        icon={<AdminIcon />}
        title="ADMIN"
        tagline="Manage user roles and access."
      />

      <main className={styles.content}>
        <UsersManager />
      </main>
    </>
  );
}
