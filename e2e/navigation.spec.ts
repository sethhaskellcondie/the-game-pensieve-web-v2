import { test, expect } from "@playwright/test";

test("home page shows the Pensieve heading", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "PENSIEVE",
  );
});

test("sidebar navigates to a collection and marks it active", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Video Games" }).click();

  await expect(page).toHaveURL("/video-games");
  // The active link exposes its state via aria-current (see Sidebar).
  await expect(page.getByRole("link", { name: "Video Games" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
