import { test, expect } from "@playwright/test";
import { AUTH_STATE } from "./authState";

// Saved-filter card reorder on the home dashboard. Regression pin for a bug
// found during touch-drag verification: onDragEnd read the final
// arrangement back out of a setRows updater, which React defers — so the
// save never fired and the reorder silently reverted on the next load. The
// drag runs against the real metadata store (page.route can't stub the
// server-loaded dashboard), so the whole flow — drop, POST, reload — is real.
test.use({ storageState: AUTH_STATE });

// The saved-filters store is shared per-account backend state and the reorder
// POST replaces it wholesale — three browsers running this spec in parallel
// clobber each other's seeds (the CLAUDE.md shared-state rule). One browser is
// enough for the persistence pin; drag activation itself was verified in all
// three engines (and via touch).
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "shared saved-filters store: run the drag-persistence pin in one browser",
);

test("dragging a saved-filter card persists the new order across a reload", async ({
  page,
}) => {
  // Seed a known two-card arrangement (the POST replaces the whole store).
  const salt = Date.now();
  const nameA = `Drag A ${salt}`;
  const nameB = `Drag B ${salt}`;
  await page.request.post("/api/saved-filters", {
    data: [
      { id: `sf-a-${salt}`, name: nameA, entity: "toy", categoryId: "__uncategorized__", order: 0, conditions: [] },
      { id: `sf-b-${salt}`, name: nameB, entity: "toy", categoryId: "__uncategorized__", order: 1, conditions: [] },
    ],
  });

  await page.goto("/");
  const cardA = page.getByRole("link", { name: nameA });
  await expect(cardA).toBeVisible();

  // Drag card A past card B (clear the 8px activation threshold first).
  // Press on the card body below the title — Firefox/WebKit won't hand the
  // gesture to dnd-kit when the press starts on the title link.
  const a = (await page
    .locator("article")
    .filter({ hasText: nameA })
    .boundingBox())!;
  const b = (await page
    .locator("article")
    .filter({ hasText: nameB })
    .boundingBox())!;
  const startY = a.y + a.height - 20;
  await page.mouse.move(a.x + a.width / 2, startY);
  await page.mouse.down();
  // Small settle pauses: the sensor attaches its move listeners on mousedown,
  // and Firefox/WebKit need a beat before the first synthetic move lands.
  await page.waitForTimeout(120);
  await page.mouse.move(a.x + a.width / 2 + 20, startY, { steps: 4 });
  await page.waitForTimeout(120);
  await page.mouse.move(b.x + b.width / 2 + 40, startY, { steps: 12 });
  await page.waitForTimeout(120);
  await page.mouse.up();

  // The swap applies in place…
  await expect(page.locator("article a").first()).toHaveText(nameB);

  // …and survives a reload because the drop actually saved. (domcontentloaded:
  // Firefox/WebKit can hold the strict load event open after the drag; the
  // assertions below auto-wait regardless.)
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: nameB })).toBeVisible();
  await expect(page.locator("article a").first()).toHaveText(nameB);
});
