import { test, expect, type Locator, type Page } from "@playwright/test";
import { AUTH_STATE } from "./authState";

// The hero row — the icon mark, the page title, and whatever the page pins to
// its right — stays one line on a phone. The titles are set in a pixel font
// that is roughly one em per character, so most of them are wider than the
// column left beside the mark; the title has to wrap inside its own column
// rather than pushing the row over and dropping the mark (or the collection
// pages' List/Shelf pill) onto a line of its own.
//
// These specs only read — no ui_settings writes, so no shared-state pinning is
// needed. The authenticated session is used so every page renders its real
// header rather than a guest redirect.
test.use({ storageState: AUTH_STATE });

// The icon mark is decorative (no accessible name), so it carries a testid.
function mark(page: Page): Locator {
  return page.getByTestId("hero-mark");
}

function title(page: Page): Locator {
  return page.getByRole("heading", { level: 1 });
}

// Assert two elements sit on the same visual row — their vertical spans
// overlap — which is what "the hero didn't wrap" amounts to.
async function expectSameRow(a: Locator, b: Locator) {
  const boxA = await a.boundingBox();
  const boxB = await b.boundingBox();
  if (!boxA || !boxB) throw new Error("hero boxes not measurable");
  expect(boxB.y).toBeLessThan(boxA.y + boxA.height);
  expect(boxA.y).toBeLessThan(boxB.y + boxB.height);
}

// Assert `right` starts after `left` ends horizontally.
async function expectLeftOf(left: Locator, right: Locator) {
  const boxL = await left.boundingBox();
  const boxR = await right.boundingBox();
  if (!boxL || !boxR) throw new Error("hero boxes not measurable");
  expect(boxL.x + boxL.width).toBeLessThanOrEqual(boxR.x + 1);
}

// Every page with a hero header. Both collection views are listed because the
// shelf and list views pin the same List/Shelf pill to the row.
const PAGES = [
  "/",
  "/systems",
  "/toys",
  "/video-games",
  "/video-games?view=shelf",
  "/board-games",
  "/board-games?view=shelf",
  "/custom-fields",
  "/options",
];

test.describe("hero header stays one row @mobile", () => {
  for (const path of PAGES) {
    test(`${path} keeps the title beside the mark`, async ({ page }) => {
      await page.goto(path);
      await expect(title(page)).toBeVisible();

      await expectSameRow(mark(page), title(page));
      await expectLeftOf(mark(page), title(page));

      // Wrapping inside the column, not spilling out of the viewport.
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  // The List/Shelf pill is a heroAside, so it shares the row too rather than
  // dropping underneath the hero.
  for (const path of [
    "/video-games",
    "/video-games?view=shelf",
    "/board-games",
    "/board-games?view=shelf",
  ]) {
    test(`${path} keeps the List/Shelf pill on the row`, async ({ page }) => {
      await page.goto(path);
      const toggle = page.getByRole("navigation", { name: "View" });
      await expect(toggle).toBeVisible();

      await expectSameRow(mark(page), toggle);
      await expectSameRow(title(page), toggle);
      await expectLeftOf(title(page), toggle);
    });
  }

  // The widest title, on the page the layout was reported broken on: it has to
  // take more than one line, since a single line would not fit the column.
  test("the toys title wraps rather than widening the row", async ({ page }) => {
    await page.goto("/toys");
    const heading = title(page);
    await expect(heading).toBeVisible();

    const { height, lineHeight } = await heading.evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(el).lineHeight),
    }));
    // Two lines or more, allowing for sub-pixel rounding on the line box.
    expect(height).toBeGreaterThan(lineHeight * 1.5);
  });
});

// The narrowest phone the layout is expected to hold together on. Pixel 7
// (the mobile project's device) is 412px wide, which leaves a comfortable
// column; 360px is the common floor and squeezes hardest, especially on the
// collection pages where the pill also wants room.
test.describe("hero header at 360px @mobile", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  for (const path of PAGES) {
    test(`${path} still keeps the title beside the mark`, async ({ page }) => {
      await page.goto(path);
      await expect(title(page)).toBeVisible();

      await expectSameRow(mark(page), title(page));
      await expectLeftOf(mark(page), title(page));

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("video games still keeps the List/Shelf pill on the row", async ({
    page,
  }) => {
    await page.goto("/video-games");
    const toggle = page.getByRole("navigation", { name: "View" });
    await expect(toggle).toBeVisible();

    await expectSameRow(mark(page), toggle);
    await expectLeftOf(title(page), toggle);
  });
});
