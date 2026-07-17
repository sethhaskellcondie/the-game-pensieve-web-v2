import buttonStyles from "@/components/Button.module.css";
import styles from "./AuthForm.module.css";

// Sign-in now happens at Keycloak's hosted login page. This is a plain "Log in"
// link that triggers a FULL navigation to GET /api/auth/login (a Route Handler),
// which starts the OIDC authorization-code + PKCE flow and 302-redirects the
// browser to Keycloak. No password is collected in-app anymore.
//
// It must be a real <a> (not a Next <Link>): /api/auth/login is a route handler,
// so we want a document navigation, not client-side routing. `error` surfaces a
// friendly message the callback route may have appended (e.g. ?error=...).
export default function LoginForm({ error }: { error?: string | null }) {
  return (
    <div className={styles.form}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <a
        className={`${buttonStyles.button} ${styles.submit}`}
        href="/api/auth/login"
      >
        Log in
      </a>
    </div>
  );
}
