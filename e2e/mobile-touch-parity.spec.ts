import { test, expect } from "@playwright/test";
import { AUTH_STATE } from "./authState";
import { seedToy } from "./apiSeed";
import { SEED, stubCustomFields } from "./customFieldsStub";

// Phase 2 touch parity (localFiles/adaptive_rollout.md): affordances that
// desktop reveals on hover must be reachable by tap at a phone viewport —
// the custom-fields delete and up/down reorder buttons (on the mobile cards
// since Phase 3; the desktop table keeps the same controls), and entity
// delete on the detail page (the only entity-delete path on mobile; the data
// tables' row delete stays desktop-only by decision).
//
// These flows are writes, so the file runs with the authenticated session
// from auth.setup.ts (the mobile project depends on the setup project too).
test.use({ storageState: AUTH_STATE });

test.describe("touch parity @mobile", () => {
  test.describe("custom fields", () => {
    test.beforeEach(async ({ page }) => {
      await stubCustomFields(page, SEED);
      await page.goto("/custom-fields");
      await expect(page.getByText("Designers", { exact: true })).toBeVisible();
    });

    test("the delete button is visible without hover and deletes on tap", async ({
      page,
    }) => {
      const del = page.getByRole("button", { name: "Delete Designers" });
      // Really visible, not the desktop's hover-revealed opacity: 0.
      await expect(del).toHaveCSS("opacity", "1");

      await del.tap();
      const menu = page.getByRole("menu", { name: "Delete Designers?" });
      await expect(menu.getByText("Are you sure?")).toBeVisible();
      await menu.getByRole("menuitem", { name: "Delete" }).tap();

      await expect(page.getByText("Designers", { exact: true })).toHaveCount(0);
    });

    test("renames a field inline from its card", async ({ page }) => {
      await page.getByRole("button", { name: "Designers", exact: true }).tap();

      const input = page.getByRole("textbox", { name: "Name for Designers" });
      await input.fill("Designer");
      await input.press("Enter");

      await expect(page.getByText("Custom field updated.")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Designer", exact: true }),
      ).toBeVisible();
    });

    test("reorders fields with the up/down buttons and persists the order", async ({
      page,
    }) => {
      const down = page.getByRole("button", { name: "Move Designers down" });
      await expect(down).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Move Designers up" }),
      ).toBeDisabled();

      await down.tap();

      // The cards swap in place…
      const cards = page
        .getByRole("list", { name: "Custom fields" })
        .getByRole("listitem");
      await expect(cards.first()).toContainText("Theme");
      // …and the new order was persisted (the stub serves it back on reload).
      await page.reload();
      await expect(page.getByText("Designers", { exact: true })).toBeVisible();
      await expect(cards.first()).toContainText("Theme");
    });
  });

  test("deletes a toy from its detail page", async ({ page }) => {
    // Detail pages fetch server-side (page.route can't stub them), so seed a
    // real toy in the e2e account and delete that.
    const toy = await seedToy(page);
    await page.goto(`/toys/${toy.id}`);

    await page.getByRole("button", { name: "Delete Toy" }).tap();
    const menu = page.getByRole("menu", { name: "Delete Toy?" });
    await expect(menu.getByText("Are you sure?")).toBeVisible();
    await menu.getByRole("menuitem", { name: "Delete" }).tap();

    await expect(page).toHaveURL("/toys");
    await expect(page.getByText("Toy deleted.")).toBeVisible();
  });
});
