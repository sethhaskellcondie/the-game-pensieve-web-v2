import { test, expect } from "@playwright/test";

// Mobile twin of navigation.spec.ts (Phase 1, localFiles/adaptive_rollout.md):
// at a phone viewport the sidebar rail is replaced by a top bar whose hamburger
// opens a slide-in drawer with the same nav.

test.describe("mobile navigation @mobile", () => {
  test("shows the top bar instead of the sidebar rail", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
    // The rail's nav (with its "Collections" group label) must be hidden; the
    // drawer copy is hidden too until opened, so no link is visible at all.
    await expect(
      page.getByRole("link", { name: "Video Games" }),
    ).toBeHidden();
  });

  test("drawer opens, navigates to each section, and closes on selection", async ({
    page,
  }) => {
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Menu" });

    const sections: Array<[string, string]> = [
      ["Video Games", "/video-games"],
      ["Board Games", "/board-games"],
      ["Toys", "/toys"],
      ["Systems", "/systems"],
      ["Custom Fields", "/custom-fields"],
    ];

    for (const [name, path] of sections) {
      await menu.click();
      await expect(menu).toHaveAttribute("aria-expanded", "true");

      await page.getByRole("link", { name }).click();
      await expect(page).toHaveURL(path);
      // Selecting a link dismisses the drawer.
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByRole("link", { name })).toBeHidden();
    }
  });

  test("marks the current section active in the drawer", async ({ page }) => {
    await page.goto("/toys");

    await page.getByRole("button", { name: "Menu" }).click();

    await expect(page.getByRole("link", { name: "Toys" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByRole("link", { name: "Video Games" }),
    ).not.toHaveAttribute("aria-current");
  });

  test("Escape and the backdrop both close the drawer", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Menu" });

    await menu.click();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");

    await menu.click();
    // The drawer is 300px wide; the backdrop owns the rest of the viewport.
    await page.mouse.click(370, 300);
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  });

  test("home page still shows the Pensieve heading", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "PENSIEVE",
    );
  });
});
