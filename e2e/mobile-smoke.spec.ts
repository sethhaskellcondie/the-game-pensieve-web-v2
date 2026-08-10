import { test, expect, type Page } from "@playwright/test";
import { skipUnlessSecured } from "./securedOnly";

// Every page
// must load at a phone viewport with its real h1 and without horizontally
// overflowing the document. This spec is the permanent regression guard for
// "nothing overflows" — when a page is made truly mobile-friendly,
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

// securedOnly pages redirect home on the permit-all backend (no accounts, no
// pricing), so their layout only exists — and is only asserted — when secured.
const PAGES: { path: string; heading: string; securedOnly?: true }[] = [
  { path: "/", heading: "PENSIEVE" },
  { path: "/video-games", heading: "VIDEO" },
  { path: "/video-games?view=shelf", heading: "VIDEO" },
  { path: "/board-games", heading: "BOARD" },
  { path: "/board-games?view=shelf", heading: "BOARD" },
  { path: "/toys", heading: "TOYS" },
  { path: "/systems", heading: "SYSTEMS" },
  { path: "/custom-fields", heading: "CUSTOM" },
  { path: "/pricing", heading: "Pricing", securedOnly: true },
  { path: "/login", heading: "PENSIEVE", securedOnly: true },
];

test.describe("mobile smoke @mobile", () => {
  for (const { path, heading, securedOnly } of PAGES) {
    test(`${path} shows its heading without horizontal overflow`, async ({
      page,
      request,
    }) => {
      if (securedOnly) await skipUnlessSecured(request);
      await page.goto(path);

      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        heading,
      );
      await expectNoHorizontalOverflow(page);
    });
  }

  // Guests have no settings or account details; these routes bounce to login.
  // (Guests only exist on a secured backend — permit-all has no login page.)
  for (const path of ["/options", "/account"]) {
    test(`${path} redirects guests to the login page`, async ({
      page,
      request,
    }) => {
      await skipUnlessSecured(request);
      await page.goto(path);

      await expect(page).toHaveURL(/\/login$/);
      await expectNoHorizontalOverflow(page);
    });
  }
});
