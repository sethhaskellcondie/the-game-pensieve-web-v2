import { test as setup } from "@playwright/test";
import { AUTH_STATE } from "./authState";
import { loginViaKeycloak } from "./keycloakLogin";

// Logs in through the real Keycloak hosted-login flow and saves the browser state
// (the iron-session cookie) for the authenticated specs.
//
// Why this exists: since the role implementation, an anonymous browser is always
// a GUEST viewing the public showcase — no write controls, /options and /account
// redirect to /login. Specs that create/edit data therefore opt into this state
// via `test.use({ storageState: AUTH_STATE })`.
//
// Auth is now Keycloak OIDC (the homegrown register/login endpoints are gone and
// the realm has registrationAllowed:false), so instead of registering a fresh
// throwaway account per run we sign in as the seeded `seth` test user (first
// login JIT-provisions a 30-day TRIAL). Requires the backend's `secured` profile
// AND Keycloak running — the same requirement the suite's secured specs place on
// showcase data being present.
const KC_USER = process.env.E2E_KC_USER || "seth";
const KC_PASSWORD = process.env.E2E_KC_PASSWORD || "password";

setup("sign in the shared e2e account", async ({ page, request }) => {
  // Against an unsecured (personal, local) backend there are no accounts to log
  // into — /login itself redirects home — so save an empty state instead of
  // failing the whole run. In that mode the anonymous caller already has full
  // capabilities; e2e/unsecured.spec.ts carries the coverage, while the
  // secured-mode specs (plan badges, login, showcases) are expected to fail and
  // should not be run against an unsecured backend.
  const heartbeat = await request.get("/api/heartbeat");
  const { secureMode } = (await heartbeat.json()) as {
    secureMode?: boolean | null;
  };
  if (secureMode === false) {
    await page.context().storageState({ path: AUTH_STATE });
    return;
  }

  await loginViaKeycloak(page, KC_USER, KC_PASSWORD);
  await page.context().storageState({ path: AUTH_STATE });
});
