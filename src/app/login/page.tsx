import Image from "next/image";
import type { Metadata } from "next";
import Header from "@/components/Header";
import LoginForm from "@/components/auth/LoginForm";
import SignupForm from "@/components/auth/SignupForm";
import ShowcaseSwitcher from "@/components/auth/ShowcaseSwitcher";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Log in · The Game Pensieve",
};

export default function LoginPage() {
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
          {/* Primary path: sign in to your own collection. */}
          <section className={styles.panel} aria-labelledby="login-heading">
            <h2 id="login-heading" className={styles.panelTitle}>
              Log in
            </h2>
            <p className={styles.panelText}>
              Welcome back to The Game Pensieve.
            </p>
            <LoginForm />
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

          {/* Secondary path: create a new account. Registration auto-grants a
              30-day trial and logs straight in. */}
          <section className={styles.panel} aria-labelledby="signup-heading">
            <h2 id="signup-heading" className={styles.panelTitle}>
              New here?
            </h2>
            <p className={styles.panelText}>
              Start a free 30-day trial — build your own collection.
            </p>
            <SignupForm />
          </section>
        </div>
      </main>
    </>
  );
}
