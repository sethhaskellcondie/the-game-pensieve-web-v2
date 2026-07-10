import { test, expect } from "@playwright/test";

// Coverage for the backend's UNSECURED (permit-all) profile: a personal, local,
// single-user instance where users, permissions, and profiles don't apply. The
// anonymous caller owns the collection — full write capabilities, everything on
// the options page, and the auth-only pages (login/account/admin/pricing)
// redirect home.
//
// The backend runs in exactly one mode per deployment, so these specs probe
// /api/heartbeat once and skip themselves against a secured backend (where the
// rest of the suite applies instead). No spec here mutates ui_settings or
// collection data, so they are safe to run alongside the other read-only specs.
test.beforeEach(async ({ request }) => {
  const heartbeat = await request.get("/api/heartbeat");
  const { secureMode } = (await heartbeat.json()) as {
    secureMode?: boolean | null;
  };
  test.skip(
    secureMode !== false,
    "unsecured-mode specs require the backend's permit-all build",
  );
});

test("auth-only pages redirect to the home page", async ({ page }) => {
  for (const path of ["/login", "/account", "/pricing", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/");
  }
});

test("the sidebar offers Options but no account panel or login", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Options" })).toBeVisible();
  // No accounts exist: no login entry, no plan readout.
  await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(0);
  await expect(page.getByText("Plan", { exact: true })).toHaveCount(0);
});

test("no showcase notice — the collection is the caller's own", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("status", { name: "Showcase notice" }),
  ).toHaveCount(0);
});

test("write controls are available anonymously", async ({ page }) => {
  await page.goto("/toys");
  await expect(page.getByRole("button", { name: "New" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add filter" })).toBeVisible();
});

test("the options page is reachable and fully available", async ({ page }) => {
  await page.goto("/options");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("OPTIONS");
  // Admin-only gating doesn't apply: the Developer Mode toggle is present
  // (asserted visible only — flipping it would mutate shared ui_settings).
  await expect(
    page.getByRole("switch", { name: "Developer Mode" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Backup & Import" }),
  ).toBeVisible();
});
