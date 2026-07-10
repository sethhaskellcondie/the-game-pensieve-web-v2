import { test, expect, type Page } from "@playwright/test";
import { AUTH_STATE } from "./authState";
import { seedVideoGameBox } from "./apiSeed";
import { DEFAULT_STANDARD_FIELDS } from "../src/lib/uiSettings.types";

// At a phone viewport the
// video games list and the shelf of boxes render as tappable cards instead of
// the data table. Cards are read/navigate-only — the whole card opens the
// detail page; there is no delete action and no mass edit on mobile.
//
// Create flows are writes, so the file runs with the authenticated session.
test.use({ storageState: AUTH_STATE });

type StubSystem = {
  id: number;
  key: "system";
  name: string;
  generation: number;
  handheld: boolean;
  customFieldValues: [];
  createdAt: string;
  updatedAt: string;
  deletedAt: null;
};

const SYSTEMS: StubSystem[] = [
  { id: 1, key: "system", name: "NES", generation: 3, handheld: false, customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
  { id: 2, key: "system", name: "SNES", generation: 4, handheld: false, customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
];

const GAME_FIELDS = [
  { id: 10, name: "Favorite", type: "boolean", entityKey: "videoGame", order: 0, options: [] },
  {
    id: 11,
    name: "Playthrough",
    type: "progress_bar",
    entityKey: "videoGame",
    order: 1,
    options: [
      { id: 21, customFieldId: 11, name: "Started", isDefault: true, order: 0 },
      { id: 22, customFieldId: 11, name: "Played", isDefault: false, order: 1 },
      { id: 23, customFieldId: 11, name: "Finished", isDefault: false, order: 2 },
    ],
  },
  {
    id: 12,
    name: "Genre",
    type: "dropdown",
    entityKey: "videoGame",
    order: 2,
    options: [
      { id: 31, customFieldId: 12, name: "Action", isDefault: true, order: 0 },
    ],
  },
];

const BOX_FIELDS = [
  { id: 13, name: "Sealed", type: "boolean", entityKey: "videoGameBox", order: 0, options: [] },
];

const GAMES = [
  {
    id: 1,
    key: "videoGame",
    title: "Super Mario Bros.",
    system: SYSTEMS[0],
    videoGameBoxes: [
      { id: 31, title: "Super Mario Bros. / Duck Hunt" },
      { id: 32, title: "Super Mario Bros." },
    ],
    customFieldValues: [
      { customFieldId: 10, customFieldName: "Favorite", customFieldType: "boolean", value: "true", valueOptionId: null },
      { customFieldId: 11, customFieldName: "Playthrough", customFieldType: "progress_bar", value: "Played", valueOptionId: 22 },
      { customFieldId: 12, customFieldName: "Genre", customFieldType: "dropdown", value: "Action", valueOptionId: 31 },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 2,
    key: "videoGame",
    title: "Chrono Trigger",
    system: SYSTEMS[1],
    videoGameBoxes: [],
    customFieldValues: [
      { customFieldId: 10, customFieldName: "Favorite", customFieldType: "boolean", value: "false", valueOptionId: null },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

const BOXES = [
  {
    id: 31,
    key: "videoGameBox",
    title: "Super Mario All-Stars",
    system: SYSTEMS[1],
    videoGames: [
      { id: 1, title: "Super Mario Bros.", system: SYSTEMS[1], customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
      { id: 2, title: "Super Mario Bros. 3", system: SYSTEMS[1], customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
    ],
    isPhysical: true,
    isCollection: true,
    customFieldValues: [
      { customFieldId: 13, customFieldName: "Sealed", customFieldType: "boolean", value: "false", valueOptionId: null },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

// Both entity screens share the same generic filter-spec shape; the specs here
// never filter, so a minimal spec (title only) keeps the FilterBar happy.
function filterSpec(type: string) {
  return {
    type: `${type}_filters`,
    fields: { title: "text", all_fields: "sort", pagination_fields: "pagination" },
    filters: {
      title: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
      all_fields: ["order_by", "order_by_desc"],
      pagination_fields: ["limit", "offset"],
    },
  };
}

// Stubs both screens' proxies (list + shelf) so they run without live data.
// The boxes store is mutable so the create flow's new box shows up.
async function stubVideoGamePages(page: Page) {
  const boxes = BOXES.map((b) => ({ ...b }));
  let nextId = 100;
  const json = (route: Parameters<Parameters<Page["route"]>[1]>[0], body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await page.route("**/api/video-games**", (route) =>
    json(route, { status: "ok", data: GAMES }),
  );
  await page.route("**/api/video-game-boxes**", (route) => {
    const req = route.request();
    if (req.method() === "POST" && !req.url().includes("/search")) {
      const body = req.postDataJSON() as {
        title: string;
        systemId: number;
        newVideoGames: { title: string; systemId: number }[];
      };
      const system = SYSTEMS.find((s) => s.id === body.systemId) ?? SYSTEMS[0];
      const created = {
        id: nextId++,
        key: "videoGameBox",
        title: body.title,
        system,
        videoGames: body.newVideoGames.map((g, i) => ({
          id: 500 + i,
          title: g.title,
          system,
          customFieldValues: [],
          createdAt: "",
          updatedAt: "",
          deletedAt: null,
        })),
        isPhysical: false,
        isCollection: false,
        customFieldValues: [],
        createdAt: "",
        updatedAt: "",
        deletedAt: null,
      };
      boxes.unshift(created);
      return json(route, { status: "ok", data: created });
    }
    return json(route, { status: "ok", data: boxes });
  });
  await page.route("**/api/systems**", (route) =>
    json(route, { status: "ok", data: SYSTEMS }),
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
  await page.route("**/api/filters/videoGame", (route) =>
    json(route, { status: "ok", data: filterSpec("videoGame") }),
  );
  await page.route("**/api/filters/videoGameBox", (route) =>
    json(route, { status: "ok", data: filterSpec("videoGameBox") }),
  );
  await page.route("**/api/custom-fields/entity/videoGame", (route) =>
    json(route, { status: "ok", data: GAME_FIELDS }),
  );
  await page.route("**/api/custom-fields/entity/videoGameBox", (route) =>
    json(route, { status: "ok", data: BOX_FIELDS }),
  );
}

// ui_settings are loaded server-side (page.route can't stub them), so pin the
// modes these specs assume — the same values every other spec pins, per the
// CLAUDE.md shared-backend-state rule.
async function pinNormalMode(page: Page) {
  const current = await (await page.request.get("/api/ui-settings")).json();
  await page.request.post("/api/ui-settings", {
    data: {
      ...current,
      massInputMode: false,
      massEditMode: false,
      videoGamesDefaultView: "list",
      standardFields: DEFAULT_STANDARD_FIELDS,
    },
  });
}

test.describe("video game cards @mobile", () => {
  test.beforeEach(async ({ page }) => {
    await pinNormalMode(page);
    await stubVideoGamePages(page);
  });

  test("the list renders as cards with each field in its slot", async ({
    page,
  }) => {
    await page.goto("/video-games");

    // Cards replace the table entirely.
    const mario = page.getByRole("link", { name: "Super Mario Bros." });
    await expect(mario).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);

    // Standard fields: system + box count in the subtitle.
    const card = page.locator("li").filter({ has: mario });
    await expect(card.getByText("NES · 2 boxes")).toBeVisible();
    // First boolean → corner glyph; progress → bar; dropdown → pill.
    await expect(card.getByRole("img", { name: "Favorite: Yes" })).toBeVisible();
    await expect(
      card.getByRole("img", { name: "Playthrough: Played (2 of 3)" }),
    ).toBeVisible();
    await expect(card.getByText("Action")).toBeVisible();

    // A sparse record still gets its card (glyph shows the No state).
    const chrono = page.locator("li").filter({
      has: page.getByRole("link", { name: "Chrono Trigger" }),
    });
    await expect(chrono.getByRole("img", { name: "Favorite: No" })).toBeVisible();

    // The always-visible toggle prefixes pills/bars with their field names. Its
    // label flips between "Show field names" and "Hide field names" as it's
    // pressed, so match on the stable part of the name rather than a fixed label.
    const namesToggle = page.getByRole("button", { name: /field names/i });
    await expect(namesToggle).toBeVisible();
    await namesToggle.tap();
    await expect(namesToggle).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByText("Genre: Action")).toBeVisible();
    await namesToggle.tap();
    await expect(card.getByText("Action", { exact: true })).toBeVisible();

    // Read/navigate-only: no delete controls, no inline editors.
    await expect(page.getByRole("button", { name: /^Delete/ })).toHaveCount(0);
  });

  test("the shelf renders box cards with Physical as the corner badge", async ({
    page,
  }) => {
    await page.goto("/video-games?view=shelf");

    const box = page.locator("li").filter({
      has: page.getByRole("link", { name: "Super Mario All-Stars" }),
    });
    await expect(box.getByText("SNES · 2 games")).toBeVisible();
    // The corner badge is always Physical (full labelled pill); the Sealed
    // boolean custom field lands in the pill row.
    const physical = box.getByRole("img", { name: "Physical: Yes" });
    await expect(physical).toBeVisible();
    await expect(physical).toContainText("Physical");
    await expect(box.getByRole("img", { name: "Sealed: No" })).toBeVisible();
    // Collection is deliberately absent — the games count already says it.
    await expect(box.getByRole("img", { name: /Collection/ })).toHaveCount(0);
    await expect(page.locator("table")).toHaveCount(0);
  });

  test("creates a box through the New dialog and it appears as a card", async ({
    page,
  }) => {
    await page.goto("/video-games?view=shelf");
    await expect(
      page.getByRole("link", { name: "Super Mario All-Stars" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "New" }).tap();
    const dialog = page.getByRole("dialog", { name: "Create Video Game Box" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("textbox", { name: "Title" }).fill("Mega Man Collection");
    await dialog.getByRole("textbox", { name: "Title" }).press("Enter");
    // Select the system by keyboard — the option list's hover auto-scroll
    // fights the tap stability check (same workaround as the desktop spec).
    await dialog.getByRole("button", { name: "System" }).click();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await dialog.getByRole("button", { name: "Add New Game" }).click();
    const gameDialog = page.getByRole("dialog", {
      name: "Create Video Game",
      exact: true,
    });
    await gameDialog.getByRole("button", { name: "Edit Title" }).click();
    await gameDialog.getByRole("textbox", { name: "Title" }).fill("Mega Man");
    await gameDialog.getByRole("textbox", { name: "Title" }).press("Enter");
    await gameDialog.getByRole("button", { name: "Create", exact: true }).click();

    await dialog.getByRole("button", { name: "Create", exact: true }).click();

    await expect(page.getByText("Video game box created.")).toBeVisible();
    // The new box lands as a card at the top of the shelf.
    await expect(
      page.getByRole("link", { name: "Mega Man Collection" }),
    ).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
  });
});

test.describe("video game card navigation @mobile", () => {
  // Detail pages are server-rendered (page.route can't stub them), so this
  // flow runs against real seeded data instead of stubs.
  test("tapping a game card opens its detail page", async ({ page }) => {
    const box = (await seedVideoGameBox(page)) as unknown as {
      id: number;
      videoGames: { id: number; title: string }[];
    };
    const game = box.videoGames[0];

    await page.goto("/video-games");
    await page.getByRole("link", { name: game.title }).tap();

    await expect(page).toHaveURL(`/video-games/${game.id}`);
    // The detail page's Fields card confirms we landed on the edit view.
    await expect(page.getByText("Fields", { exact: true })).toBeVisible();
  });
});
