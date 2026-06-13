import { test, expect, type Page } from "@playwright/test";
import { DEFAULT_STANDARD_FIELDS } from "../src/lib/uiSettings.types";

type StubSlimGame = {
  id: number;
  title: string;
  customFieldValues: [];
  createdAt: string;
  updatedAt: string;
  deletedAt: null;
};

type StubBox = {
  id: number;
  key: "boardGameBox";
  title: string;
  isExpansion: boolean;
  isStandAlone: boolean;
  baseSetId: number | null;
  boardGame: StubSlimGame;
  customFieldValues: [];
  createdAt: string;
  updatedAt: string;
  deletedAt: null;
};

function slimGame(id: number, title: string): StubSlimGame {
  return {
    id,
    title,
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  };
}

const WATCH_GAME = slimGame(41, "Set-A-Watch");
const JEKYLL_GAME = slimGame(42, "Jekyll vs Hyde");

const BOXES: StubBox[] = [
  {
    id: 31,
    key: "boardGameBox",
    title: "Set-A-Watch Base Box",
    isExpansion: false,
    isStandAlone: true,
    baseSetId: null,
    boardGame: WATCH_GAME,
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 32,
    key: "boardGameBox",
    title: "Set-A-Watch Doomed Run",
    isExpansion: true,
    isStandAlone: false,
    baseSetId: 31,
    boardGame: WATCH_GAME,
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 33,
    key: "boardGameBox",
    title: "Jekyll Box",
    isExpansion: false,
    isStandAlone: true,
    baseSetId: null,
    boardGame: JEKYLL_GAME,
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

// Mirrors the live /filters/boardGameBox response shape, including the
// sort/pagination/time pseudo-fields the UI drops.
const FILTER_SPEC = {
  type: "boardGameBox_filters",
  fields: {
    title: "text",
    is_expansion: "boolean",
    is_stand_alone: "boolean",
    created_at: "time",
    updated_at: "time",
    all_fields: "sort",
    pagination_fields: "pagination",
  },
  filters: {
    title: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    is_expansion: ["equals"],
    is_stand_alone: ["equals"],
    created_at: ["since", "before"],
    updated_at: ["since", "before"],
    all_fields: ["order_by", "order_by_desc"],
    pagination_fields: ["limit", "offset"],
  },
};

type StubFilter = { key: string; field: string; operator: string; operand: string };

// A small stand-in for the backend's filter matching, enough to drive the
// shelf's server-side search in these specs.
function applyFilters(list: StubBox[], filters: StubFilter[]): StubBox[] {
  return (filters ?? []).reduce<StubBox[]>((out, f) => {
    return out.filter((box) => {
      const raw =
        f.field === "title"
          ? box.title
          : f.field === "is_expansion"
            ? String(box.isExpansion)
            : f.field === "is_stand_alone"
              ? String(box.isStandAlone)
              : "";
      const a = String(raw).toLowerCase();
      const b = f.operand.toLowerCase();
      switch (f.operator) {
        case "contains":
          return a.includes(b);
        case "equals":
          return a === b;
        case "not_equals":
          return a !== b;
        default:
          return true;
      }
    });
  }, list);
}

// Existing games the create dialog's picker can offer, mirroring the live
// /boardGames search shape (boardGameBoxes ride along).
const PICKER_GAMES = [
  {
    id: 41,
    key: "boardGame",
    title: "Set-A-Watch",
    boardGameBoxes: [
      {
        id: 31,
        title: "Set-A-Watch Base Box",
        isExpansion: false,
        isStandAlone: true,
        baseSetId: null,
        customFieldValues: [],
        createdAt: "",
        updatedAt: "",
        deletedAt: null,
      },
    ],
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 42,
    key: "boardGame",
    title: "Jekyll vs Hyde",
    boardGameBoxes: [],
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

// Stubs the board-game-box, board-game (for the list view the toggle starts
// from and the create dialog's picker), and custom-field proxies so the
// screen runs end-to-end without a live backend.
async function stubShelf(page: Page) {
  const json = (route: Parameters<Parameters<Page["route"]>[1]>[0], body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await page.route("**/api/board-game-boxes/search", (route) => {
    const { filters } = route.request().postDataJSON() as {
      filters: StubFilter[];
    };
    return json(route, { status: "ok", data: applyFilters(BOXES, filters) });
  });
  // The list view (the toggle's other side) and the create dialog's
  // existing-game picker load through this.
  await page.route("**/api/board-games**", (route) =>
    json(route, { status: "ok", data: PICKER_GAMES }),
  );
  // No stored default sorts, so row-order assertions see the backend's
  // natural order regardless of what the shared backend's metadata holds.
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
  await page.route("**/api/filters/**", (route) =>
    json(route, { status: "ok", data: FILTER_SPEC }),
  );
  await page.route("**/api/custom-fields/entity/**", (route) =>
    json(route, { status: "ok", data: [] }),
  );
}

// The mass modes and the default board-games view are loaded server-side, so
// page.route can't stub them. Pin the modes off and the default view to list
// (the bare /board-games assertions below assume it) — the same values every
// other board spec pins, to avoid clashing writes to the shared backend state.
// The standard-field columns are pinned to all-shown (the default) because
// these specs assert on the boxes table's columns.
async function pinNormalMode(page: Page) {
  const current = await (await page.request.get("/api/ui-settings")).json();
  await page.request.post("/api/ui-settings", {
    data: {
      ...current,
      massInputMode: false,
      massEditMode: false,
      boardGamesDefaultView: "list",
      standardFields: DEFAULT_STANDARD_FIELDS,
    },
  });
}

test.beforeEach(async ({ page }) => {
  await pinNormalMode(page);
  await stubShelf(page);
});

test("the Shelf toggle swaps the list for the shelf of boxes", async ({ page }) => {
  await page.goto("/board-games");

  // List view is active by default.
  const list = page.getByRole("link", { name: "List" });
  const shelf = page.getByRole("link", { name: "Shelf" });
  await expect(list).toHaveAttribute("aria-current", "page");
  await expect(shelf).not.toHaveAttribute("aria-current", "page");

  await shelf.click();

  await expect(page).toHaveURL("/board-games?view=shelf");
  await expect(shelf).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { level: 2, name: "3 Board Game Boxes" }),
  ).toBeVisible();
  // "Jekyll Box" is unique on the shelf ("Set-A-Watch Base Box" also shows in
  // the expansion row's Base Set cell).
  await expect(page.getByText("Jekyll Box", { exact: true })).toBeVisible();

  // And back: List restores the games view (explicitly, since the bare URL
  // follows the default-view setting).
  await page.getByRole("link", { name: "List" }).click();
  await expect(page).toHaveURL("/board-games?view=list");
  await expect(page.getByRole("link", { name: "List" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("the shelf URL loads directly and renders the boxes table", async ({
  page,
}) => {
  await page.goto("/board-games?view=shelf");

  await expect(
    page.getByRole("heading", { level: 2, name: "3 Board Game Boxes" }),
  ).toBeVisible();

  // The same table treatment as the games list, with the box columns.
  await expect(page.getByRole("columnheader", { name: "Title" })).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Board Game" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Expansion" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Stand Alone" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Base Set" }),
  ).toBeVisible();

  // The expansion row shows its game, Yes/No badges, and its base set's title
  // resolved from the base set's id.
  const expansionRow = page
    .getByRole("row")
    .filter({ hasText: "Set-A-Watch Doomed Run" });
  await expect(
    expansionRow.getByText("Set-A-Watch", { exact: true }),
  ).toBeVisible();
  await expect(expansionRow.getByRole("img", { name: "Yes" })).toHaveCount(1);
  await expect(expansionRow.getByRole("img", { name: "No" })).toHaveCount(1);
  await expect(
    expansionRow.getByText("Set-A-Watch Base Box", { exact: true }),
  ).toBeVisible();

  // A non-expansion has no base set — its cell shows a dash.
  const jekyllRow = page.getByRole("row").filter({ hasText: "Jekyll Box" });
  await expect(jekyllRow.getByText("—", { exact: true })).toBeVisible();
});

test("filters the shelf via the search box on Enter", async ({ page }) => {
  await page.goto("/board-games?view=shelf");
  await expect(
    page.getByText("Set-A-Watch Doomed Run", { exact: true }),
  ).toBeVisible();

  const box = page.getByRole("searchbox", { name: "Search board game boxes" });
  await box.fill("jekyll");
  await box.press("Enter");

  // The text becomes a title-contains chip and the box clears.
  await expect(page.getByRole("button", { name: "Edit Title filter" })).toBeVisible();
  await expect(box).toHaveValue("");

  await expect(page.getByText("Jekyll Box", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Set-A-Watch Doomed Run", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "1 Board Game Box" }),
  ).toBeVisible();
});

test("creates a box with a brand-new game through the stacked dialog", async ({
  page,
}) => {
  // More specific than stubShelf's catch-alls, and registered later, so this
  // wins: the create POST is captured (the exact glob skips /search and /:id).
  let postBody: Record<string, unknown> | null = null;
  await page.route("**/api/board-game-boxes", (route) => {
    postBody = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        data: {
          id: 99,
          key: "boardGameBox",
          title: postBody.title,
          isExpansion: postBody.isExpansion,
          isStandAlone: postBody.isStandAlone,
          baseSetId: postBody.baseSetId,
          boardGame: slimGame(98, "Wingspan"),
          customFieldValues: [],
          createdAt: "",
          updatedAt: "",
          deletedAt: null,
        },
      }),
    });
  });

  await page.goto("/board-games?view=shelf");
  await page.getByRole("button", { name: "New" }).click();

  const dialog = page.getByRole("dialog", { name: "Create Board Game Box" });
  const create = dialog.getByRole("button", { name: "Create", exact: true });

  // A title alone doesn't satisfy the dialog — a box holds exactly one game.
  await dialog.getByRole("button", { name: "Edit Title" }).click();
  await dialog.getByRole("textbox", { name: "Title" }).fill("Wingspan");
  await dialog.getByRole("textbox", { name: "Title" }).press("Enter");
  await expect(dialog.getByText("Pick or create the game.")).toBeVisible();
  await expect(create).toBeDisabled();

  // Queue the game through the stacked dialog. exact: the box dialog's name
  // contains this one's as a prefix.
  await dialog.getByRole("button", { name: "Add New Game" }).click();
  const gameDialog = page.getByRole("dialog", {
    name: "Create Board Game",
    exact: true,
  });
  await gameDialog.getByRole("button", { name: "Edit Title" }).click();
  await gameDialog.getByRole("textbox", { name: "Title" }).fill("Wingspan");
  await gameDialog.getByRole("textbox", { name: "Title" }).press("Enter");
  await gameDialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(gameDialog).toBeHidden();

  const queued = dialog.getByRole("list", { name: "Board game for this box" });
  await expect(queued.getByText("Wingspan", { exact: true })).toBeVisible();
  await expect(queued.getByText("New", { exact: true })).toBeVisible();

  await expect(create).toBeEnabled();
  await create.click();

  // The dialog closes, the toast confirms, and the new box tops the grid.
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Board game box created.")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "4 Board Game Boxes" }),
  ).toBeVisible();
  expect(postBody).toMatchObject({
    title: "Wingspan",
    isExpansion: false,
    isStandAlone: true,
    baseSetId: null,
    boardGameId: null,
    boardGame: { title: "Wingspan", customFieldValues: [] },
  });
});

test("creates an expansion whose base set auto-fills the linked game", async ({
  page,
}) => {
  let postBody: Record<string, unknown> | null = null;
  await page.route("**/api/board-game-boxes", (route) => {
    postBody = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        data: {
          id: 99,
          key: "boardGameBox",
          title: postBody.title,
          isExpansion: postBody.isExpansion,
          isStandAlone: postBody.isStandAlone,
          baseSetId: postBody.baseSetId,
          boardGame: WATCH_GAME,
          customFieldValues: [],
          createdAt: "",
          updatedAt: "",
          deletedAt: null,
        },
      }),
    });
  });

  await page.goto("/board-games?view=shelf");
  await page.getByRole("button", { name: "New" }).click();

  const dialog = page.getByRole("dialog", { name: "Create Board Game Box" });
  await dialog.getByRole("button", { name: "Edit Title" }).click();
  await dialog
    .getByRole("textbox", { name: "Title" })
    .fill("Set-A-Watch Forsaken Isles");
  await dialog.getByRole("textbox", { name: "Title" }).press("Enter");

  // Flag it as an expansion — the base-set picker appears.
  await dialog.getByRole("button", { name: "Expansion: No" }).click();
  const basePicker = dialog.getByRole("searchbox", { name: "Pick a base set" });
  await expect(basePicker).toBeVisible();

  await basePicker.fill("base box");
  const baseResults = dialog.getByRole("list", { name: "Matching boxes" });
  await baseResults
    .getByRole("button", { name: /^Set-A-Watch Base Box/ })
    .click();

  // The base set's game auto-filled the game section.
  const queued = dialog.getByRole("list", { name: "Board game for this box" });
  await expect(queued.getByText("Set-A-Watch", { exact: true })).toBeVisible();
  await expect(queued.getByText("Existing", { exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Board game box created.")).toBeVisible();
  expect(postBody).toMatchObject({
    title: "Set-A-Watch Forsaken Isles",
    isExpansion: true,
    baseSetId: 31,
    boardGameId: 41,
    boardGame: null,
  });
});

test("offers no per-row delete control on the boxes grid", async ({ page }) => {
  await page.goto("/board-games?view=shelf");
  await expect(page.getByText("Jekyll Box", { exact: true })).toBeVisible();

  // Delete moved off the grid row and onto the box detail page (covered by the
  // DeleteEntityButton unit test, since the detail page fetches server-side and
  // can't be stubbed through page.route).
  await expect(
    page.getByRole("button", { name: "Delete Jekyll Box" }),
  ).toHaveCount(0);
});

test("Escape closes the stacked game dialog but not the box dialog", async ({
  page,
}) => {
  await page.goto("/board-games?view=shelf");
  await page.getByRole("button", { name: "New" }).click();

  const dialog = page.getByRole("dialog", { name: "Create Board Game Box" });
  await dialog.getByRole("button", { name: "Add New Game" }).click();
  const gameDialog = page.getByRole("dialog", {
    name: "Create Board Game",
    exact: true,
  });
  await expect(gameDialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(gameDialog).toBeHidden();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

// The box detail page fetches its box server-side (Playwright's page.route
// can't stub that), so this smoke test runs against the live dev backend's
// box #1; the deterministic edit-logic coverage lives in
// __tests__/BoardGameBoxDetail.test.tsx.
test("the box detail page shows the Fields and Board Game cards and links back to the shelf", async ({
  page,
}) => {
  await page.goto("/board-game-boxes/1");

  // The Fields card with the fixed Title + Expansion + Stand Alone rows is
  // the heart of the screen; the Board Game card shows the one linked game.
  await expect(page.getByText("Fields", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Title" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Expansion: / }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Stand Alone: / }),
  ).toBeVisible();
  // Scoped to main: the sidebar also has a "Board Games" link.
  await expect(
    page.getByRole("main").getByText("Board Game", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Change the linked game" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL("/board-games?view=shelf");
  await expect(
    page.getByRole("heading", { level: 2, name: "3 Board Game Boxes" }),
  ).toBeVisible();
});
