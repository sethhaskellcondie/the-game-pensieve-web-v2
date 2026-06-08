import { test, expect } from "@playwright/test";

test("options page is reachable from the sidebar", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Options" }).click();

  await expect(page).toHaveURL("/options");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("OPTIONS");
});

test("UI Settings toggles flip and persist when clicked", async ({ page }) => {
  // Stub the write proxy so the click persists through it without mutating the
  // shared backend (otherwise the toggle's initial state leaks between runs).
  await page.route("**/api/ui-settings", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    }),
  );

  await page.goto("/options");

  const developerMode = page.getByRole("switch", { name: "Developer Mode" });
  // The initial state is loaded from the backend server-side, so assert the
  // toggle flips relative to whatever it currently is rather than a fixed value.
  const before = await developerMode.getAttribute("aria-checked");
  const expected = before === "true" ? "false" : "true";

  // Flipping the toggle should optimistically update the UI and POST the new
  // settings to the write proxy.
  const persisted = page.waitForRequest(
    (req) => req.url().includes("/api/ui-settings") && req.method() === "POST",
  );
  await developerMode.click();
  await expect(developerMode).toHaveAttribute("aria-checked", expected);
  await persisted;
});

test("toggle does not change when the persist request fails", async ({
  page,
}) => {
  // Writes are confirmed: if the backend rejects the change, the UI must stay on
  // the last known-good value rather than diverging from it.
  await page.route("**/api/ui-settings", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false }),
    }),
  );

  await page.goto("/options");

  const developerMode = page.getByRole("switch", { name: "Developer Mode" });
  const before = await developerMode.getAttribute("aria-checked");

  // Wait for the rejected write to come back before asserting nothing changed.
  const response = page.waitForResponse("**/api/ui-settings");
  await developerMode.click();
  await response;

  await expect(developerMode).toHaveAttribute("aria-checked", before ?? "false");
});

test("heartbeat reports ONLINE when the service responds", async ({ page }) => {
  await page.route("**/api/heartbeat**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "online" }),
    }),
  );

  await page.goto("/options");
  await page.getByRole("button", { name: "Check Heartbeat" }).click();

  await expect(page.getByText(/ONLINE/)).toBeVisible();
});

test("heartbeat reports OFFLINE when the service is unhealthy", async ({
  page,
}) => {
  await page.route("**/api/heartbeat**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ status: "offline" }),
    }),
  );

  await page.goto("/options");
  await page.getByRole("button", { name: "Check Heartbeat" }).click();

  await expect(page.getByText("OFFLINE")).toBeVisible();
});
