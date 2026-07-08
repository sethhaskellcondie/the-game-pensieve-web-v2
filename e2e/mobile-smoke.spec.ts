import { test, expect, type Page } from "@playwright/test";

// Phase 0 of the mobile rollout (localFiles/adaptive_rollout.md): every page
// must load at a phone viewport with its real h1 and without horizontally
// overflowing the document. This spec is the permanent regression guard for
// "nothing overflows" — when a rollout phase makes a page truly mobile-friendly,
// its behavior here must keep passing.
//
// Runs as a guest (no login): the mobile experience primarily targets guests
// viewing a public showcase. /options and /account are covered via their
// guest→login redirects; /admin 404s for non-admins and is desktop-only anyway.

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    scrollWidth,
    `document scrollWidth ${scrollWidth}px must fit the ${innerWidth}px viewport`,
  ).toBeLessThanOrEqual(innerWidth);
}

const PAGES: { path: string; heading: string }[] = [
  { path: "/", heading: "PENSIEVE" },
  { path: "/video-games", heading: "VIDEO" },
  { path: "/video-games?view=shelf", heading: "VIDEO" },
  { path: "/board-games", heading: "BOARD" },
  { path: "/board-games?view=shelf", heading: "BOARD" },
  { path: "/toys", heading: "TOYS" },
  { path: "/systems", heading: "SYSTEMS" },
  { path: "/custom-fields", heading: "CUSTOM" },
  { path: "/pricing", heading: "Pricing" },
  { path: "/login", heading: "PENSIEVE" },
];

test.describe("mobile smoke @mobile", () => {
  for (const { path, heading } of PAGES) {
    test(`${path} shows its heading without horizontal overflow`, async ({
      page,
    }) => {
      await page.goto(path);

      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        heading,
      );
      await expectNoHorizontalOverflow(page);
    });
  }

  // Guests have no settings or account details; these routes bounce to login.
  for (const path of ["/options", "/account"]) {
    test(`${path} redirects guests to the login page`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(/\/login$/);
      await expectNoHorizontalOverflow(page);
    });
  }
});
