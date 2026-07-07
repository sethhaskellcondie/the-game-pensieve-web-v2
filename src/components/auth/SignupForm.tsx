"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import { useSession } from "./SessionProvider";
import styles from "./AuthForm.module.css";

// Register a new account (the backend auto-grants a 30-day trial, so new users
// start a 30-day trial in the TRIAL role), then log straight in for a smooth
// first run.
export default function SignupForm() {
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
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const registerBody = (await registerRes.json()) as { message?: string };
      if (!registerRes.ok) {
        setError(registerBody.message || "Registration failed.");
        return;
      }

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!loginRes.ok) {
        // Account created but auto-login failed — point them at the Log in card
        // on this same page.
        setError("Account created — please log in.");
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

  // Form-only: the surrounding card and heading are composed by the login page
  // (src/app/login/page.tsx), where this sits in the "New here?" card next to the
  // Log in card.
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="signup-email">
          Email
        </label>
        <input
          id="signup-email"
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
        <label className={styles.label} htmlFor="signup-password">
          Password
        </label>
        <input
          id="signup-password"
          className={styles.input}
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
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
        {submitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
