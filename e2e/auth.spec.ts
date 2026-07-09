import { test, expect } from "@playwright/test";

// Auth/tier coverage.
//
// GUEST behavior is driven purely by the FRONTEND session (a fresh browser has
// no session cookie → guest), so it runs against any backend that can serve the
// showcase. PAID and LAPSED require the backend running with the `secured`
// profile (and, for lapsed, an operator setting the account's `access_until` to
// the past — there is no admin API). Those specs are therefore gated behind
// SECURED_BACKEND=1 so the default suite stays green; set it (and run the
// secured backend) to exercise them.
const SECURED = process.env.SECURED_BACKEND === "1";

test.describe("Guest tier", () => {
  test("shows the Guest plan and the showcase prompt", async ({ page }) => {
    await page.goto("/toys");
    await expect(page.getByLabel("Plan: Guest")).toBeVisible();
    await expect(
      page.getByText("You’re viewing the public showcase."),
    ).toBeVisible();
  });

  test("hides write controls but allows filtering the showcase", async ({
    page,
  }) => {
    await page.goto("/toys");
    // No write affordance for guests.
    await expect(page.getByRole("button", { name: "New" })).toHaveCount(0);
    // Guests CAN filter the showcase.
    await expect(page.getByRole("button", { name: "Add filter" })).toBeEnabled();
  });

  test("offers a login link from the account panel", async ({ page }) => {
    await page.goto("/toys");
    await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();
  });

  test("redirects to login when visiting the account page", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("Trial tier (new account)", () => {
  test.skip(!SECURED, "needs the secured backend (SECURED_BACKEND=1)");

  test("register, persist across reload, expose writes, then log out", async ({
    page,
  }) => {
    const email = `e2e+${Date.now()}@example.com`;
    const password = "Sup3rSecret!";

    // Sign-up now lives in the "New here?" card on the login page. Scope to that
    // card so its Email/Password fields aren't confused with the Log in card's.
    await page.goto("/login");
    const signup = page.getByRole("region", { name: "New here?" });
    await signup.getByLabel("Email").fill(email);
    await signup.getByLabel("Password").fill(password);
    await signup.getByRole("button", { name: "Create account" }).click();

    // Auto-login lands on home as a TRIAL account (30-day trial).
    await expect(page.getByLabel("Plan: Trial")).toBeVisible();

    // Session is BFF-held: persists across a full reload.
    await page.reload();
    await expect(page.getByLabel("Plan: Trial")).toBeVisible();

    // The account page shows the signed-in email and the current plan.
    await page.getByRole("link", { name: "Account" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(
      page.getByRole("heading", { name: "ACCOUNT" }),
    ).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByLabel("Plan: Trial")).toBeVisible();
    // A trial account shows how long the plan stays active. The default trial
    // window is 30 days, so the days-left hint renders alongside the date.
    await expect(page.getByText("Active until")).toBeVisible();
    await expect(page.getByText(/left\)/)).toBeVisible();

    // Write controls are available to TRIAL users.
    await page.goto("/toys");
    await expect(page.getByRole("button", { name: "New" })).toBeVisible();
    await page.getByRole("button", { name: "New" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    // Seed a persisted collection view, as if this trial session had filtered
    // or sorted a page. Logout must drop these — they reference the user's own
    // (possibly custom) fields, which the default showcase doesn't define.
    await page.evaluate(() => {
      localStorage.setItem("filters:toy", "[]");
      localStorage.setItem("sorts:toy", "[]");
    });

    // Logout returns to Guest and hard-navigates home, so the page reloads as
    // the default showcase (its own metadata + filters), not the user's data.
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByLabel("Plan: Guest")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    // The logged-in session's persisted filters/sorts were cleared on the way
    // out, so nothing stale reloads for the default showcase.
    const leftoverViews = await page.evaluate(() =>
      Object.keys(localStorage).filter(
        (k) => k.startsWith("filters:") || k.startsWith("sorts:"),
      ),
    );
    expect(leftoverViews).toEqual([]);

    // The reloaded collection view is the default showcase's, read-only: no
    // write control, but a guest may still filter it.
    await page.goto("/toys");
    await expect(
      page.getByText("You’re viewing the public showcase."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "New" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Add filter" }),
    ).toBeEnabled();
  });
});

test.describe("Lapsed tier", () => {
  test.skip(
    !SECURED,
    "needs the secured backend AND an operator-set past access_until (no admin API)",
  );

  // Precondition (manual / fixture): log in as an account whose access_until is
  // in the past. This spec assumes the test harness has established that session
  // — e.g. via a storageState produced by a fixture that registers an account
  // and an operator expires it through SQL on the users table.
  test("blocks filtering and writing, surfacing the upgrade prompt", async ({
    page,
  }) => {
    await page.goto("/toys");
    await expect(page.getByLabel("Plan: Lapsed")).toBeVisible();

    // Filter control is disabled for lapsed accounts.
    await expect(page.getByRole("button", { name: "Add filter" })).toBeDisabled();
    // Write control is absent.
    await expect(page.getByRole("button", { name: "New" })).toHaveCount(0);
  });
});
