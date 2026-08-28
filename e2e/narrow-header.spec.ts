import { test, expect, type Locator, type Page } from "@playwright/test";
import { AUTH_STATE } from "./authState";

// A list page's header — the entity count, the quick-search, Sort, Filter and
// New — has to stay on one line at every width, not just on a phone. It gets
// cramped well above the phone breakpoint because the sidebar stays docked at
// 220px, so the content column is far narrower than the window; the header
// answers in three stages (see the bands in FilterBar.module.css):
//
//   > 1100px  everything, labelled
//   ≤ 1100px  the quick-search drops (the Filter button makes the same chip)
//   ≤ 900px   Sort / Filter / New collapse to their glyphs
//   ≤ 767px   the phone layout (covered by the @mobile specs)
//
// These specs only read — no ui_settings writes, so no shared-state pinning is
// needed. The authenticated session is used because the New button is a write
// affordance and only an active account sees it.
test.use({ storageState: AUTH_STATE });

// Every list page with a filter bar, including both shelf views — their
// "Video Game Boxes" / "Board Game Boxes" counts are the longest, so they are
// the first headers to wrap.
const LIST_PAGES = [
  "/systems",
  "/toys",
  "/video-games",
  "/video-games?view=shelf",
  "/board-games",
  "/board-games?view=shelf",
];

// The entity count heading each list page leads with ("43 Systems").
function count(page: Page): Locator {
  return page.getByRole("heading", { level: 2 }).first();
}

// Assert `control` sits on the same visual row as the count — their vertical
// spans overlap — which is what "the header didn't wrap" amounts to.
async function expectSameRow(page: Page, control: Locator) {
  const countBox = await count(page).boundingBox();
  const box = await control.boundingBox();
  if (!countBox || !box) throw new Error("header boxes not measurable");
  expect(box.y).toBeLessThan(countBox.y + countBox.height);
  expect(countBox.y).toBeLessThan(box.y + box.height);
}

test.describe("at 820px the header collapses to glyphs", () => {
  test.use({ viewport: { width: 820, height: 900 } });

  for (const path of LIST_PAGES) {
    test(`${path} keeps its header on one row`, async ({ page }) => {
      await page.goto(path);
      await expect(count(page)).toBeVisible();

      // The search box is gone at this width; Sort and Filter are icon-only but
      // keep their labels as accessible names (the label is clipped, not
      // removed), so they answer to the same names as on a wide window.
      await expect(page.getByRole("searchbox")).toBeHidden();
      for (const name of ["Sort", "Add filter"]) {
        const button = page.getByRole("button", { name });
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        if (!box) throw new Error(`${name} not measurable`);
        // Only the glyph plus padding — a labelled button is far wider.
        expect(box.width).toBeLessThan(60);
        await expectSameRow(page, button);
      }
    });
  }

  // The list views of video games and board games are read-only (their rows are
  // derived), so only the shelf views and the plain collections offer New.
  for (const path of ["/systems", "/toys", "/video-games?view=shelf"]) {
    test(`${path} collapses its New button too`, async ({ page }) => {
      await page.goto(path);
      const newButton = page.getByRole("button", { name: "New" });
      await expect(newButton).toBeVisible();
      const box = await newButton.boundingBox();
      if (!box) throw new Error("New not measurable");
      expect(box.width).toBeLessThan(60);
      await expectSameRow(page, newButton);
    });
  }
});

test.describe("at 1000px only the quick-search drops", () => {
  test.use({ viewport: { width: 1000, height: 900 } });

  test("systems hides the search box but keeps the labelled buttons", async ({
    page,
  }) => {
    await page.goto("/systems");
    await expect(count(page)).toBeVisible();

    await expect(
      page.getByRole("searchbox", { name: "Search systems" }),
    ).toBeHidden();

    for (const name of ["Sort", "Add filter", "New"]) {
      const button = page.getByRole("button", { name });
      const box = await button.boundingBox();
      if (!box) throw new Error(`${name} not measurable`);
      // Still labelled at this width, so wider than the collapsed glyph.
      expect(box.width).toBeGreaterThan(60);
      await expectSameRow(page, button);
    }
  });
});

test.describe("at 1280px the header is complete", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("systems shows the search box alongside the labelled buttons", async ({
    page,
  }) => {
    await page.goto("/systems");

    const search = page.getByRole("searchbox", { name: "Search systems" });
    await expect(search).toBeVisible();
    await expectSameRow(page, search);
    for (const name of ["Sort", "Add filter", "New"]) {
      await expectSameRow(page, page.getByRole("button", { name }));
    }
  });
});
