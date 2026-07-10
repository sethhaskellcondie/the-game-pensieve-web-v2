import { test as setup, expect } from "@playwright/test";
import { AUTH_STATE } from "./authState";

// Registers a fresh trial account through the real signup UI and saves its
// browser state (the iron-session cookie) for the authenticated specs.
//
// Why this exists: since the role implementation, an anonymous browser is
// always a GUEST viewing the public showcase — no write controls, /options and
// /account redirect to /login. Specs that create/edit data therefore opt into
// this state via `test.use({ storageState: AUTH_STATE })`.
//
// A fresh `e2e+<timestamp>` account per run (the auth.spec pattern) keeps the
// suite self-sufficient: no seed-script dependency, no 30-day trial expiry on
// a fixed account, and a clean, empty collection so create-then-assert specs
// never collide with a previous run's leftovers. Registration requires the
// backend's `secured` profile — the same requirement the suite's guest tests
// already place on showcase data being present.
setup("register the shared e2e account", async ({ page, request }) => {
  // Against an unsecured (personal, local) backend there are no accounts to
  // register — /login itself redirects home — so save an empty state instead
  // of failing the whole run. In that mode the anonymous caller already has
  // full capabilities; e2e/unsecured.spec.ts carries the coverage, while the
  // secured-mode specs (plan badges, login, showcases) are expected to fail
  // and should not be run against an unsecured backend.
  const heartbeat = await request.get("/api/heartbeat");
  const { secureMode } = (await heartbeat.json()) as {
    secureMode?: boolean | null;
  };
  if (secureMode === false) {
    await page.context().storageState({ path: AUTH_STATE });
    return;
  }

  const email = `e2e+${Date.now()}@example.com`;
  const password = "Sup3rSecret!";

  await page.goto("/login");
  const signup = page.getByRole("region", { name: "New here?" });
  await signup.getByLabel("Email").fill(email);
  await signup.getByLabel("Password").fill(password);
  await signup.getByRole("button", { name: "Create account" }).click();

  // Auto-login lands on home as a TRIAL account; the session cookie is now set.
  await expect(page.getByLabel("Plan: Trial")).toBeVisible();

  await page.context().storageState({ path: AUTH_STATE });
});
