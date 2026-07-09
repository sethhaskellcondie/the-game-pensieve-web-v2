import { test, expect } from "@playwright/test";
import { AUTH_STATE } from "./authState";
import { SEED, stubCustomFields } from "./customFieldsStub";

// These specs exercise write flows (create dialogs, inline edits, deletes)
// that the guest UI hides, so the whole file runs with the authenticated
// session from auth.setup.ts. All backend data is stubbed via page.route
// (see customFieldsStub.ts, shared with the mobile touch-parity twin) —
// only the session (and the server-loaded ui_settings) is real.
test.use({ storageState: AUTH_STATE });

test.beforeEach(async ({ page }) => {
  await stubCustomFields(page, SEED);
});

test("is reachable from the sidebar and lists the Board Game fields", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Custom Fields" }).click();

  await expect(page).toHaveURL("/custom-fields");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("CUSTOM");
  await expect(
    page.getByRole("heading", { level: 2, name: "Board Game" }),
  ).toBeVisible();
  await expect(page.getByText("Designers", { exact: true })).toBeVisible();
  await expect(page.getByText("Theme", { exact: true })).toBeVisible();
});

test("switching the entity scope swaps the heading and rows", async ({ page }) => {
  await page.goto("/custom-fields");
  await expect(page.getByText("Designers", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /board game/i }).click();
  await page.getByRole("option", { name: "Video Game", exact: true }).click();

  await expect(
    page.getByRole("heading", { level: 2, name: "Video Game" }),
  ).toBeVisible();
  await expect(page.getByText("Platform", { exact: true })).toBeVisible();
  await expect(page.getByText("Designers", { exact: true })).toHaveCount(0);
});

test("creates a new field via the modal", async ({ page }) => {
  await page.goto("/custom-fields");
  await expect(page.getByText("Designers", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "New" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Field name").fill("Publisher");
  await dialog.getByRole("button", { name: "Create field" }).click();

  await expect(page.getByText("Custom field created.")).toBeVisible();
  await expect(page.getByText("Publisher", { exact: true })).toBeVisible();
});

test("edits a field's options via the modal", async ({ page }) => {
  await page.goto("/custom-fields");
  // The options cell opens the edit modal.
  await page.getByRole("button", { name: "Edit Theme" }).click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Update Custom Field" }),
  ).toBeVisible();

  await dialog.getByRole("button", { name: /add option/i }).click();
  await dialog.getByRole("textbox", { name: "Option 2" }).fill("Sci-Fi");
  await dialog.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Custom field updated.")).toBeVisible();
  await expect(page.getByText("Sci-Fi")).toBeVisible();
});

test("renames a field inline from the name cell", async ({ page }) => {
  await page.goto("/custom-fields");
  await page.getByRole("button", { name: "Designers", exact: true }).click();

  const input = page.getByRole("textbox", { name: "Name for Designers" });
  await input.fill("Designer");
  await input.press("Enter");

  await expect(page.getByText("Custom field updated.")).toBeVisible();
  await expect(page.getByText("Designer", { exact: true })).toBeVisible();
  await expect(page.getByText("Designers", { exact: true })).toHaveCount(0);
});

test("deletes a field from its row", async ({ page }) => {
  await page.goto("/custom-fields");
  const row = page.getByRole("row").filter({ hasText: "Designers" });
  await row.hover();
  await row.getByRole("button", { name: "Delete Designers" }).click();

  // The trash opens an "Are you sure?" confirmation; the field is only removed
  // once its Delete is confirmed.
  const menu = page.getByRole("menu", { name: "Delete Designers?" });
  await expect(menu.getByText("Are you sure?")).toBeVisible();
  await menu.getByRole("menuitem", { name: "Delete" }).click();

  await expect(page.getByText("Designers", { exact: true })).toHaveCount(0);
});
