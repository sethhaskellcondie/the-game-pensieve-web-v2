"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/Button";
import { useSession } from "./SessionProvider";
import styles from "./AuthForm.module.css";

// Log in via the BFF, which stores the backend tokens in the httpOnly session
// cookie. On success we pull the fresh session view into the provider and return
// to the home page.
export default function LoginForm() {
  const router = useRouter();
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(body.message || "Login failed.");
        return;
      }
      await refresh();
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Log in</h1>
      <p className={styles.subtitle}>Welcome back to The Game Pensieve.</p>

      <form className={styles.form} onSubmit={onSubmit}>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className={styles.input}
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button
          className={styles.submit}
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <p className={styles.alt}>
        Need an account? <Link href="/signup">Sign up</Link>
      </p>
    </div>
  );
}
