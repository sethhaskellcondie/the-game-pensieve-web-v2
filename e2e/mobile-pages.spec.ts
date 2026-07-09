import { test, expect } from "@playwright/test";
import { AUTH_STATE } from "./authState";

// The remaining pages — options,
// account, and the home dashboard — render usable phone layouts. Options and
// account are login-gated, so the file runs with the authenticated session
// (their guest redirects are covered by mobile-smoke.spec.ts).
//
// These specs only read — no ui_settings writes, so no shared-state pinning
// is needed.
test.use({ storageState: AUTH_STATE });

test.describe("remaining pages @mobile", () => {
  test("options shows its settings sections but not Backup & Import", async ({
    page,
  }) => {
    await page.goto("/options");

    await expect(
      page.getByRole("heading", { name: "UI Settings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Default Sort Options" }),
    ).toBeVisible();
    // (API Tools is developer-mode-gated, so it isn't asserted here.)
    // Import/export is desktop-only (decided): the whole section is hidden.
    await expect(
      page.getByRole("heading", { name: "Backup & Import" }),
    ).toBeHidden();
  });

  test("account shows the profile section", async ({ page }) => {
    await page.goto("/account");

    // Scoped to main — the CSS-hidden desktop rail also carries Email/Plan
    // labels and would trip strict mode.
    const main = page.getByRole("main");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(main.getByText("Email", { exact: true })).toBeVisible();
    await expect(main.getByText("Plan", { exact: true })).toBeVisible();
  });

  test("the home dashboard greets and offers New Category", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByText("Welcome back!")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New Category" }),
    ).toBeVisible();
  });
});
