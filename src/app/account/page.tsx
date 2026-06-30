import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import AccountManager from "@/components/account/AccountManager";
import { AccountIcon } from "@/components/icons";
import { loadSessionView } from "@/lib/session";
import styles from "./account.module.css";

export const metadata: Metadata = {
  title: "Account · The Game Pensieve",
};

// Account information page. Requires a signed-in user — a guest has no account,
// so send them to log in. The live client session drives the displayed values
// (see AccountManager); this server gate just keeps anonymous visitors out of
// the shell.
export default async function AccountPage() {
  const { role } = await loadSessionView();
  if (role === "guest") redirect("/login");

  return (
    <>
      <Header
        icon={<AccountIcon />}
        title="ACCOUNT"
        tagline="View your account details and manage your plan."
      />

      <main className={styles.content}>
        <AccountManager />
      </main>
    </>
  );
}
