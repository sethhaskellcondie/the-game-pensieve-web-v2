import { test, expect, type Page, type Route } from "@playwright/test";
import { AUTH_STATE } from "./authState";
import { seedBoardGameBox, seedToy } from "./apiSeed";
import { DEFAULT_STANDARD_FIELDS } from "../src/lib/uiSettings.types";

// Phase 5 (localFiles/adaptive_rollout.md): at a phone viewport the detail
// pages stack their field rows (label above value) and the create modals grow
// into full-screen sheets. Light edit stays in scope on mobile — inline
// detail-page edits work by tap (the Phase 2 always-visible pencil marks
// them).
//
// Detail pages are server-rendered (page.route can't stub them), so these
// flows run against real seeded rows with the authenticated session.
test.use({ storageState: AUTH_STATE });

const json = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

async function pinNormalMode(page: Page) {
  const current = await (await page.request.get("/api/ui-settings")).json();
  await page.request.post("/api/ui-settings", {
    data: {
      ...current,
      massInputMode: false,
      massEditMode: false,
      standardFields: DEFAULT_STANDARD_FIELDS,
    },
  });
}

test.describe("mobile detail pages @mobile", () => {
  test("inline-edits a toy's field on the detail page and saves", async ({
    page,
  }) => {
    const toy = await seedToy(page);
    await page.goto(`/toys/${toy.id}`);

    // Tap-to-edit: the Set row opens its inline input, Enter commits. The
    // server-rendered page hydrates late under full-suite load, so a too-early
    // tap can land before the handler exists — retry until the editor opens.
    const input = page.getByRole("textbox", { name: "Set" });
    await expect(async () => {
      await page.getByRole("button", { name: "Edit Set" }).tap();
      await expect(input).toBeVisible({ timeout: 1000 });
    }).toPass();
    await input.fill("Mobile Edited Set");
    await input.press("Enter");

    await expect(page.getByText("Toy updated.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Edit Set" }),
    ).toContainText("Mobile Edited Set");
  });

  test("a board game box detail page renders and links back to the shelf", async ({
    page,
  }) => {
    const box = await seedBoardGameBox(page);
    await page.goto(`/board-game-boxes/${box.id}`);

    // The stacked Fields card and the box's board game section both render.
    await expect(page.getByText("Fields", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Title" })).toBeVisible();

    await page.getByRole("link", { name: "Back" }).tap();
    await expect(page).toHaveURL("/board-games?view=shelf");
  });
});

test.describe("mobile create sheet @mobile", () => {
  test.beforeEach(async ({ page }) => {
    await pinNormalMode(page);
    await page.route("**/api/toys**", (route) =>
      json(route, { status: "ok", data: [] }),
    );
    await page.route("**/api/custom-fields/entity/toy", (route) =>
      json(route, { status: "ok", data: [] }),
    );
    await page.route("**/api/filters/toy", (route) =>
      json(route, {
        status: "ok",
        data: {
          type: "toy_filters",
          fields: { name: "text" },
          filters: { name: ["contains"] },
        },
      }),
    );
    await page.route("**/api/default-sort-options", (route) =>
      json(route, {
        toy: [],
        system: [],
        videoGame: [],
        videoGameBox: [],
        boardGame: [],
        boardGameBox: [],
      }),
    );
  });

  test("the create modal opens as a full-screen sheet", async ({ page }) => {
    await page.goto("/toys");
    await page.getByRole("button", { name: "New" }).tap();

    const dialog = page.getByRole("dialog", { name: "Create Toy" });
    await expect(dialog).toBeVisible();
    // Sheet, not a floating card: it spans the whole viewport. Poll — the
    // modal's pop animation scales it up over its first frames.
    await expect
      .poll(async () => (await dialog.boundingBox())!.width)
      .toBe(page.viewportSize()!.width);
    await expect
      .poll(async () => (await dialog.boundingBox())!.height)
      .toBe(page.viewportSize()!.height);

    await dialog.getByRole("button", { name: "Cancel" }).tap();
    await expect(dialog).toBeHidden();
  });
});
