import { test, expect } from "@playwright/test";

test("options page is reachable from the sidebar", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Options" }).click();

  await expect(page).toHaveURL("/options");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("OPTIONS");
});

test("UI Settings toggles flip when clicked", async ({ page }) => {
  await page.goto("/options");

  const developerMode = page.getByRole("switch", { name: "Developer Mode" });
  await expect(developerMode).toHaveAttribute("aria-checked", "false");

  await developerMode.click();
  await expect(developerMode).toHaveAttribute("aria-checked", "true");
});

test("heartbeat reports ONLINE when the service responds", async ({ page }) => {
  await page.route("**/api/heartbeat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "online" }),
    }),
  );

  await page.goto("/options");
  await page.getByRole("button", { name: "Run Heartbeat" }).click();

  await expect(page.getByText(/ONLINE/)).toBeVisible();
});

test("heartbeat reports OFFLINE when the service is unhealthy", async ({
  page,
}) => {
  await page.route("**/api/heartbeat", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ status: "offline" }),
    }),
  );

  await page.goto("/options");
  await page.getByRole("button", { name: "Run Heartbeat" }).click();

  await expect(page.getByText("OFFLINE")).toBeVisible();
});
