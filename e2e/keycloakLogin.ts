import { expect, type Page } from "@playwright/test";

// Drives the real Keycloak hosted-login flow end to end: click "Log in" on the
// app's /login page → 302 to Keycloak → fill the hosted form → land back on the
// app with a live session cookie. Since the homegrown password login was replaced
// by Keycloak OIDC (authorization-code + PKCE), this is how authenticated specs
// establish a session.
//
// Uses Keycloak's stable default-theme IDs (#username, #password, #kc-login),
// falling back to accessible labels if the theme is customized.
export async function loginViaKeycloak(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  // Scope to the "Log in" panel: the sidebar also has a "Log in" link (→ /login),
  // whereas the one we want is the panel's anchor to /api/auth/login (→ Keycloak).
  await page
    .getByRole("region", { name: "Log in" })
    .getByRole("link", { name: "Log in" })
    .click();

  // Now on Keycloak's hosted login page (a different origin/port).
  await page.waitForURL(/\/realms\/pensieve\/protocol\/openid-connect\/auth/);
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.locator("#kc-login").click();

  // Back on the app, authenticated. The caller asserts the resulting plan/role.
  await page.waitForURL((url) => !/\/realms\/pensieve\//.test(url.toString()));
  await expect(page.getByLabel(/^Plan:/)).toBeVisible();
}
