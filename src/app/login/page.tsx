import Image from "next/image";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import LoginForm from "@/components/auth/LoginForm";
import ShowcaseSwitcher from "@/components/auth/ShowcaseSwitcher";
import { getAuthMode } from "@/lib/authMode";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Log in · The Game Pensieve",
};

export default async function LoginPage({
  searchParams,
}: {
  // Next passes searchParams as a Promise. The callback route may redirect back
  // here with a friendly ?error=... when a login couldn't be completed.
  searchParams?: Promise<{ error?: string | string[] }>;
} = {}) {
  // An unsecured backend has no accounts to log into — worse, logging in there
  // actively degrades the session (the token is ignored and the role resolves
  // to "unknown"), so this page must be unreachable in that mode.
  if ((await getAuthMode()) === "unsecured") redirect("/");

  const rawError = (await searchParams)?.error;
  const error = Array.isArray(rawError) ? rawError[0] : rawError;

  return (
    <>
      <Header
        icon={<Image src="/blue_pensieve.svg" alt="" width={78} height={78} />}
        title="THE GAME"
        titleAccent="PENSIEVE"
        tagline="Explore ALL your games — not just how they appear on the shelf."
      />

      <main className={styles.content}>
        <div className={styles.grid}>
          {/* Primary path: sign in to your own collection. Sign-in now happens
              at Keycloak's hosted login page (the button navigates there); no
              password is collected in-app. Account creation is admin-driven in
              Keycloak, so there's no in-app sign-up this pass. */}
          <section className={styles.panel} aria-labelledby="login-heading">
            <h2 id="login-heading" className={styles.panelTitle}>
              Log in
            </h2>
            <p className={styles.panelText}>
              Welcome back to The Game Pensieve.
            </p>
            <LoginForm error={error} />
          </section>

          {/* Guests can browse any public showcase without an account. The
              switcher shares the app-wide SessionProvider, so its pick
              persists via the same showcase cookie used elsewhere. */}
          <section className={styles.panel} aria-labelledby="guest-heading">
            <h2 id="guest-heading" className={styles.panelTitle}>
              Browse as a guest
            </h2>
            <p className={styles.panelText}>
              Explore a public showcase — no account needed.
            </p>
            <ShowcaseSwitcher />
          </section>
        </div>
      </main>
    </>
  );
}
