import { test, expect } from "@playwright/test";
import { AUTH_STATE } from "./authState";
import { skipUnlessSecured } from "./securedOnly";

// The remaining pages — options,
// account, the home dashboard, and the custom-fields header — render usable
// phone layouts. Options and
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

  test("account shows the profile section", async ({ page, request }) => {
    // The account page only exists behind a login; on the permit-all backend
    // /account redirects home (unsecured.spec.ts asserts that redirect).
    await skipUnlessSecured(request);
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

    await expect(page.getByText("Welcome!")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New Category" }),
    ).toBeVisible();
  });

  // The custom-fields header must stay one row at a phone width: the New
  // button collapses to its "+" icon rather than the title and the actions
  // wrapping onto two lines.
  test("custom fields keeps its title and New button on one header row", async ({
    page,
  }) => {
    await page.goto("/custom-fields");

    // boardGame is the default scope, so the title is always "Board Game".
    const title = page.getByRole("heading", { name: "Board Game", level: 2 });
    const newButton = page.getByRole("button", { name: "New" });
    await expect(title).toBeVisible();
    // Icon-only, but still named "New" for assistive tech (the label is
    // clipped, not removed).
    await expect(newButton).toBeVisible();

    const titleBox = await title.boundingBox();
    const buttonBox = await newButton.boundingBox();
    if (!titleBox || !buttonBox) throw new Error("header boxes not measurable");
    // Same row: their vertical spans overlap.
    expect(buttonBox.y).toBeLessThan(titleBox.y + titleBox.height);
    expect(titleBox.y).toBeLessThan(buttonBox.y + buttonBox.height);
    // Only the "+" glyph plus padding — a labelled button is far wider.
    expect(buttonBox.width).toBeLessThan(60);
  });
  // The systems header must stay one row too: the count, the three collapsed
  // toolbar buttons, and the New button all share a line, with every label
  // clipped down to its glyph.
  test("systems keeps its count and toolbar on one header row", async ({
    page,
  }) => {
    await page.goto("/systems");

    const count = page.getByRole("heading", { level: 2 });
    await expect(count).toContainText("Systems");

    // Icon-only, but each still carries its label as an accessible name.
    const buttons = [
      page.getByRole("button", { name: /field names/i }),
      page.getByRole("button", { name: "Sort" }),
      page.getByRole("button", { name: "Add filter" }),
      page.getByRole("button", { name: "New" }),
    ];

    const countBox = await count.boundingBox();
    if (!countBox) throw new Error("header count not measurable");
    for (const button of buttons) {
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      if (!box) throw new Error("header button not measurable");
      // Same row as the count: their vertical spans overlap.
      expect(box.y).toBeLessThan(countBox.y + countBox.height);
      expect(countBox.y).toBeLessThan(box.y + box.height);
      // Only the glyph plus padding — a labelled button is far wider.
      expect(box.width).toBeLessThan(60);
    }
  });
});
