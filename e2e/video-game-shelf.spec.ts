import { test, expect, type Page } from "@playwright/test";
import { DEFAULT_STANDARD_FIELDS } from "../src/lib/uiSettings.types";

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

type StubBox = {
  id: number;
  key: "videoGameBox";
  title: string;
  system: StubSystem;
  videoGames: { id: number; title: string }[];
  isPhysical: boolean;
  isCollection: boolean;
  customFieldValues: [];
  createdAt: string;
  updatedAt: string;
  deletedAt: null;
};

const SYSTEMS: StubSystem[] = [
  { id: 1, key: "system", name: "NES", generation: 3, handheld: false, customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
  { id: 2, key: "system", name: "SNES", generation: 4, handheld: false, customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
];

const BOXES: StubBox[] = [
  {
    id: 31,
    key: "videoGameBox",
    title: "Super Mario Bros.",
    system: SYSTEMS[0],
    videoGames: [{ id: 1, title: "Super Mario Bros." }],
    isPhysical: true,
    isCollection: false,
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 32,
    key: "videoGameBox",
    title: "Super Mario All-Stars",
    system: SYSTEMS[1],
    videoGames: [
      { id: 2, title: "Super Mario Bros." },
      { id: 3, title: "Super Mario Bros. 3" },
    ],
    isPhysical: true,
    isCollection: true,
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 33,
    key: "videoGameBox",
    title: "Chrono Trigger",
    system: SYSTEMS[1],
    videoGames: [{ id: 4, title: "Chrono Trigger" }],
    isPhysical: false,
    isCollection: false,
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

// Mirrors the live /filters/videoGameBox response shape, including the
// sort/pagination/time pseudo-fields the UI drops.
const FILTER_SPEC = {
  type: "videoGameBox_filters",
  fields: {
    title: "text",
    system_id: "system",
    isPhysical: "boolean",
    isCollection: "boolean",
    created_at: "time",
    updated_at: "time",
    all_fields: "sort",
    pagination_fields: "pagination",
  },
  filters: {
    title: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    system_id: ["equals", "not_equals"],
    isPhysical: ["equals", "not_equals"],
    isCollection: ["equals", "not_equals"],
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
          : f.field === "system_id"
            ? String(box.system.id)
            : f.field === "isPhysical"
              ? String(box.isPhysical)
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

// Stubs the video-game-box, video-game (for the list view the toggle starts
// from), system, and custom-field proxies so the screen runs end-to-end
// without a live backend.
async function stubShelf(page: Page) {
  const json = (route: Parameters<Parameters<Page["route"]>[1]>[0], body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await page.route("**/api/video-game-boxes/search", (route) => {
    const { filters } = route.request().postDataJSON() as {
      filters: StubFilter[];
    };
    return json(route, { status: "ok", data: applyFilters(BOXES, filters) });
  });
  // The list view (the toggle's other side) loads through these.
  await page.route("**/api/video-games**", (route) =>
    json(route, { status: "ok", data: [] }),
  );
  await page.route("**/api/systems**", (route) =>
    json(route, { status: "ok", data: SYSTEMS }),
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

// Existing games the create dialog's picker can offer, mirroring the live
// /videoGames search shape (system + videoGameBoxes ride along).
const PICKER_GAMES = [
  {
    id: 61,
    key: "videoGame",
    title: "Mega Man 2",
    system: SYSTEMS[0],
    videoGameBoxes: [],
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 62,
    key: "videoGame",
    title: "Mega Man 3",
    system: SYSTEMS[0],
    videoGameBoxes: [{ id: 31, title: "Super Mario Bros." }],
    customFieldValues: [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

// The mass modes and the default video-games view are loaded server-side, so
// page.route can't stub them. Pin the modes off and the default view to list
// (the bare /video-games assertions below assume it) — the same values every
// other spec pins, to avoid clashing writes to the shared backend state.
// The standard-field columns are pinned to all-shown (the default) because
// these specs assert on the boxes table's columns.
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

test.beforeEach(async ({ page }) => {
  await pinNormalMode(page);
  await stubShelf(page);
});

test("the Shelf toggle swaps the list for the shelf of boxes", async ({ page }) => {
  await page.goto("/video-games");

  // List view is active by default.
  const list = page.getByRole("link", { name: "List" });
  const shelf = page.getByRole("link", { name: "Shelf" });
  await expect(list).toHaveAttribute("aria-current", "page");
  await expect(shelf).not.toHaveAttribute("aria-current", "page");

  await shelf.click();

  await expect(page).toHaveURL("/video-games?view=shelf");
  await expect(shelf).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { level: 2, name: "3 Video Game Boxes" }),
  ).toBeVisible();
  await expect(
    page.getByText("Super Mario Bros.", { exact: true }),
  ).toBeVisible();

  // And back: List restores the games view (explicitly, since the bare URL
  // follows the default-view setting).
  await page.getByRole("link", { name: "List" }).click();
  await expect(page).toHaveURL("/video-games?view=list");
  await expect(page.getByRole("link", { name: "List" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("the shelf URL loads directly and renders the boxes table", async ({
  page,
}) => {
  await page.goto("/video-games?view=shelf");

  await expect(
    page.getByRole("heading", { level: 2, name: "3 Video Game Boxes" }),
  ).toBeVisible();

  // The same table treatment as the games list, with the box columns.
  await expect(page.getByRole("columnheader", { name: "Title" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "System" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Games" })).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Physical" }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Collection" }),
  ).toBeVisible();

  // Each row shows its box's system, game count, and Yes/No badges.
  const allStarsRow = page
    .getByRole("row")
    .filter({ hasText: "Super Mario All-Stars" });
  await expect(allStarsRow.getByText("SNES", { exact: true })).toBeVisible();
  await expect(allStarsRow.getByText("2", { exact: true })).toBeVisible();
  await expect(allStarsRow.getByRole("img", { name: "Yes" })).toHaveCount(2);

  const chronoRow = page.getByRole("row").filter({ hasText: "Chrono Trigger" });
  await expect(chronoRow.getByText("1", { exact: true })).toBeVisible();
  await expect(chronoRow.getByRole("img", { name: "No" })).toHaveCount(2);
});

test("filters the shelf via the search box on Enter", async ({ page }) => {
  await page.goto("/video-games?view=shelf");
  await expect(
    page.getByText("Super Mario Bros.", { exact: true }),
  ).toBeVisible();

  const box = page.getByRole("searchbox", { name: "Search video game boxes" });
  await box.fill("chrono");
  await box.press("Enter");

  // The text becomes a title-contains chip and the box clears.
  await expect(page.getByRole("button", { name: "Edit Title filter" })).toBeVisible();
  await expect(box).toHaveValue("");

  await expect(page.getByText("Chrono Trigger", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Super Mario Bros.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "1 Video Game Box" }),
  ).toBeVisible();
});

test("creates a box through the New dialog with a new game and an existing game", async ({
  page,
}) => {
  // More specific than stubShelf's catch-alls, and registered later, so these
  // win: the picker's game search returns real rows, and the create POST is
  // captured (the exact glob skips /search and /:id).
  await page.route("**/api/video-games/search", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok", data: PICKER_GAMES }),
    }),
  );
  let postBody: Record<string, unknown> | null = null;
  await page.route("**/api/video-game-boxes", (route) => {
    postBody = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        data: {
          id: 99,
          key: "videoGameBox",
          title: postBody.title,
          system: SYSTEMS[0],
          videoGames: [{ id: 901, title: "Mega Man" }],
          isPhysical: postBody.isPhysical,
          isCollection: true,
          customFieldValues: [],
          createdAt: "",
          updatedAt: "",
          deletedAt: null,
        },
      }),
    });
  });

  await page.goto("/video-games?view=shelf");
  await page.getByRole("button", { name: "New" }).click();

  const dialog = page.getByRole("dialog", { name: "Create Video Game Box" });
  const create = dialog.getByRole("button", { name: "Create", exact: true });

  // Title + System alone don't satisfy the dialog — a box needs ≥1 game.
  await dialog.getByRole("button", { name: "Edit Title" }).click();
  await dialog.getByRole("textbox", { name: "Title" }).fill("Mega Man Collection");
  await dialog.getByRole("textbox", { name: "Title" }).press("Enter");
  await dialog.getByRole("button", { name: "System" }).click();
  await page.getByRole("option", { name: "NES", exact: true }).click();
  await expect(dialog.getByText("Add at least one game.")).toBeVisible();
  await expect(create).toBeDisabled();

  // Queue a brand-new game through the stacked dialog. exact: the box
  // dialog's name contains this one's as a prefix.
  await dialog.getByRole("button", { name: "Add New Game" }).click();
  const gameDialog = page.getByRole("dialog", {
    name: "Create Video Game",
    exact: true,
  });
  await gameDialog.getByRole("button", { name: "Edit Title" }).click();
  await gameDialog.getByRole("textbox", { name: "Title" }).fill("Mega Man");
  await gameDialog.getByRole("textbox", { name: "Title" }).press("Enter");
  await gameDialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(gameDialog).toBeHidden();

  // Attach an existing game via the picker; the one already shelved says so.
  const picker = dialog.getByRole("searchbox", { name: "Add an existing game" });
  await picker.fill("mega man");
  const results = dialog.getByRole("list", { name: "Matching games" });
  await expect(results.getByText("in Super Mario Bros.")).toBeVisible();
  await results.getByRole("button", { name: /^Mega Man 2/ }).click();

  const queued = dialog.getByRole("list", { name: "Games in this box" });
  await expect(queued.getByText("Mega Man", { exact: true })).toBeVisible();
  await expect(queued.getByText("Mega Man 2", { exact: true })).toBeVisible();

  await expect(create).toBeEnabled();
  await create.click();

  // The dialog closes, the toast confirms, and the new box tops the grid.
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Video game box created.")).toBeVisible();
  await expect(
    page.getByText("Mega Man Collection", { exact: true }),
  ).toBeVisible();
  expect(postBody).toMatchObject({
    title: "Mega Man Collection",
    systemId: 1,
    existingVideoGameIds: [61],
    newVideoGames: [{ title: "Mega Man", systemId: 1, customFieldValues: [] }],
    isPhysical: false,
  });
});

test("deletes a box from the grid after the Are-you-sure confirmation", async ({
  page,
}) => {
  let deletedUrl: string | null = null;
  await page.route("**/api/video-game-boxes/*", (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    deletedUrl = route.request().url();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok" }),
    });
  });

  await page.goto("/video-games?view=shelf");
  await expect(
    page.getByText("Chrono Trigger", { exact: true }),
  ).toBeVisible();

  // The trash opens the confirmation; dismissing it deletes nothing.
  await page.getByRole("button", { name: "Delete Chrono Trigger" }).click();
  const menu = page.getByRole("menu", { name: "Delete Chrono Trigger?" });
  await expect(menu.getByText("Are you sure?")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  expect(deletedUrl).toBeNull();
  await expect(
    page.getByText("Chrono Trigger", { exact: true }),
  ).toBeVisible();

  // Confirming removes the row and toasts.
  await page.getByRole("button", { name: "Delete Chrono Trigger" }).click();
  await menu.getByRole("menuitem", { name: "Delete" }).click();

  await expect(page.getByText("Video game box deleted.")).toBeVisible();
  await expect(page.getByText("Chrono Trigger", { exact: true })).toHaveCount(
    0,
  );
  expect(String(deletedUrl)).toContain("/api/video-game-boxes/33");
});

test("Escape closes the stacked game dialog but not the box dialog", async ({
  page,
}) => {
  await page.goto("/video-games?view=shelf");
  await page.getByRole("button", { name: "New" }).click();

  const dialog = page.getByRole("dialog", { name: "Create Video Game Box" });
  await dialog.getByRole("button", { name: "Add New Game" }).click();
  const gameDialog = page.getByRole("dialog", {
    name: "Create Video Game",
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
// __tests__/VideoGameBoxDetail.test.tsx.
test("the box detail page shows the Fields and Video Games cards and links back to the shelf", async ({
  page,
}) => {
  await page.goto("/video-game-boxes/1");

  // The Fields card with the fixed Title + System + Physical rows is the heart
  // of the screen; the Video Games card lists the games inside the box.
  await expect(page.getByText("Fields", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Title" })).toBeVisible();
  await expect(page.getByRole("button", { name: "System" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Physical: / })).toBeVisible();
  // Collection is derived and uneditable, so the Fields card omits it.
  await expect(page.getByText("Collection", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Collection/ })).toHaveCount(0);

  // Games are created from the card header; the dialog flow itself is covered
  // by the VideoGameBoxDetail/VideoGameCreateModal unit tests.
  await expect(
    page.getByRole("button", { name: "New Video Game" }),
  ).toBeVisible();
  // Scoped to main: the sidebar also has a "Video Games" link.
  await expect(
    page.getByRole("main").getByText("Video Games", { exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL("/video-games?view=shelf");
  await expect(
    page.getByRole("heading", { level: 2, name: "3 Video Game Boxes" }),
  ).toBeVisible();
});
