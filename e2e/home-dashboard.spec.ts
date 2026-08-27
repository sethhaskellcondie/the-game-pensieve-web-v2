import { test, expect, type Page } from "@playwright/test";
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

// Both specs here seed the saved-filters store with a wholesale POST, and the
// config runs tests fully parallel — so run this file serially, or the two
// seeds race and clobber each other.
test.describe.configure({ mode: "serial" });

// Three systems whose default (backend) order is deliberately not alphabetical,
// so a sorted order is distinguishable from an unsorted one.
const SYSTEMS = ["NES", "SNES", "Game Boy"].map((name, i) => ({
  id: i + 1,
  key: "system",
  name,
  generation: 3,
  handheld: false,
  customFieldValues: [],
  createdAt: "",
  updatedAt: "",
  deletedAt: null,
}));

type StubFilter = { key: string; field: string; operator: string; operand: string };

// The systems page, stubbed: the search honors a name sort filter the way the
// backend does, so the rows read out whatever sort the page actually sent. The
// home dashboard itself is NOT stubbed — it loads server-side from the real
// metadata store, which is why the saved filter is seeded over the API.
async function stubSystems(page: Page) {
  const json = (route: Parameters<Parameters<Page["route"]>[1]>[0], body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await page.route("**/api/systems**", (route) => {
    const req = route.request();
    if (req.url().includes("/search") && req.method() === "POST") {
      const { filters } = req.postDataJSON() as { filters: StubFilter[] };
      const sort = (filters ?? []).find(
        (f) => f.field === "name" && f.operator.startsWith("order_by"),
      );
      const rows = [...SYSTEMS];
      if (sort) {
        rows.sort((a, b) =>
          sort.operator === "order_by_desc"
            ? b.name.localeCompare(a.name)
            : a.name.localeCompare(b.name),
        );
      }
      return json(route, { status: "ok", data: rows });
    }
    return json(route, { status: "ok", data: SYSTEMS });
  });
  await page.route("**/api/filters/system", (route) =>
    json(route, {
      status: "ok",
      data: {
        type: "system_filters",
        // all_fields: "sort" is the capability marker that turns on the Sort
        // control; sort filters themselves carry the real field name.
        fields: { name: "text", all_fields: "sort" },
        filters: {
          name: ["equals", "contains"],
          all_fields: ["order_by", "order_by_desc"],
        },
      },
    }),
  );
  await page.route("**/api/custom-fields/entity/system", (route) =>
    json(route, { status: "ok", data: [] }),
  );
  // No stored default sort, so the only sort in play is the saved filter's.
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
}

// ui_settings load server-side (page.route can't stub them); pin both mass
// modes off so the systems grid renders in its normal form. Shared backend
// state, so every spec touching these settings pins the same values — see
// systems-sort.spec.ts.
async function pinNormalMode(page: Page) {
  const current = await (await page.request.get("/api/ui-settings")).json();
  await page.request.post("/api/ui-settings", {
    data: { ...current, massInputMode: false, massEditMode: false },
  });
}

test("a saved filter's sort levels are applied when its card is opened", async ({
  page,
}) => {
  await pinNormalMode(page);
  const salt = Date.now();
  const name = `Sorted systems ${salt}`;
  await page.request.post("/api/saved-filters", {
    data: [
      {
        id: `sf-sort-${salt}`,
        name,
        entity: "system",
        categoryId: "__uncategorized__",
        order: 0,
        conditions: [],
        sorts: [{ id: "s-1", field: "name", label: "Name", direction: "desc" }],
      },
    ],
  });

  await stubSystems(page);
  await page.goto("/");

  // The card advertises the sort it will apply…
  const card = page.locator("article").filter({ hasText: name });
  await expect(card.getByLabel("Name descending")).toBeVisible();

  // …and opening it lands on the systems page already sorted.
  await page.getByRole("link", { name }).click();
  await expect(page).toHaveURL(/\/systems\?.*sorts=/);
  await expect(page.locator("tbody tr td:first-child")).toHaveText([
    "SNES",
    "NES",
    "Game Boy",
  ]);
  // The level shows in the Sort control's count, so it can be edited/cleared
  // like any hand-entered sort.
  await expect(
    page.getByRole("button", { name: "Sort", exact: true }),
  ).toContainText("1");
});

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
