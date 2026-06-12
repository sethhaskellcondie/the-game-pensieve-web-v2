import { test, expect, type Page } from "@playwright/test";
import { DEFAULT_STANDARD_FIELDS } from "../src/lib/uiSettings.types";

type StubField = {
  id: number;
  name: string;
  type: string;
  entityKey: string;
  order: number;
  options: [];
};

type StubGame = {
  id: number;
  key: "boardGame";
  title: string;
  boardGameBoxes: {
    id: number;
    title: string;
    isExpansion: boolean;
    isStandAlone: boolean;
    baseSetId: number | null;
    customFieldValues: [];
    createdAt: string;
    updatedAt: string;
    deletedAt: null;
  }[];
  customFieldValues: {
    customFieldId: number;
    customFieldName: string;
    customFieldType: string;
    value: string;
  }[];
  createdAt: string;
  updatedAt: string;
  deletedAt: null;
};

const FIELDS: StubField[] = [
  { id: 10, name: "Has App", type: "boolean", entityKey: "boardGame", order: 0, options: [] },
  { id: 11, name: "Min Players", type: "number", entityKey: "boardGame", order: 1, options: [] },
];

// Mirrors the live /filters/boardGame response shape: title + timestamps plus
// the sort/pagination pseudo-fields the UI drops. Board games have no
// relationship (system-kind) filter fields.
const FILTER_SPEC = {
  type: "boardGame_filters",
  fields: {
    title: "text",
    created_at: "time",
    updated_at: "time",
    all_fields: "sort",
    pagination_fields: "pagination",
  },
  filters: {
    title: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    created_at: ["since", "before"],
    updated_at: ["since", "before"],
    all_fields: ["order_by", "order_by_desc"],
    pagination_fields: ["limit", "offset"],
  },
};

function slimBox(id: number, title: string) {
  return {
    id,
    title,
    isExpansion: false,
    isStandAlone: true,
    baseSetId: null,
    customFieldValues: [] as [],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  };
}

const GAMES: StubGame[] = [
  {
    id: 1,
    key: "boardGame",
    title: "Set-A-Watch",
    boardGameBoxes: [
      slimBox(31, "Set-A-Watch Base Box"),
      slimBox(32, "Set-A-Watch Doomed Run"),
    ],
    customFieldValues: [
      { customFieldId: 10, customFieldName: "Has App", customFieldType: "boolean", value: "true" },
      { customFieldId: 11, customFieldName: "Min Players", customFieldType: "number", value: "1" },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 2,
    key: "boardGame",
    title: "Jekyll vs Hyde",
    boardGameBoxes: [],
    customFieldValues: [
      { customFieldId: 10, customFieldName: "Has App", customFieldType: "boolean", value: "false" },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

type StubFilter = { key: string; field: string; operator: string; operand: string };

// A small stand-in for the backend's filter matching, enough to drive the
// server-side search in these specs.
function applyFilters(list: StubGame[], filters: StubFilter[]): StubGame[] {
  return (filters ?? []).reduce<StubGame[]>((out, f) => {
    return out.filter((g) => {
      const raw =
        f.field === "title"
          ? g.title
          : (g.customFieldValues.find((v) => v.customFieldName === f.field)
              ?.value ?? "");
      const a = String(raw).toLowerCase();
      const b = f.operand.toLowerCase();
      switch (f.operator) {
        case "contains":
          return a.includes(b);
        case "equals":
          return a === b;
        case "not_equals":
          return a !== b;
        case "starts_with":
          return a.startsWith(b);
        case "ends_with":
          return a.endsWith(b);
        default:
          return true;
      }
    });
  }, list);
}

// Stubs the board-game, board-game-box (the shelf the toggle leads to), and
// custom-field proxies so the screen runs end-to-end without a live backend.
async function stubBoardGames(page: Page) {
  const json = (route: Parameters<Parameters<Page["route"]>[1]>[0], body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  // The list loads and searches through the POST search endpoint; branch it so a
  // search applies its filters and any other call returns the full list.
  await page.route("**/api/board-games**", (route) => {
    const req = route.request();
    if (req.url().includes("/search") && req.method() === "POST") {
      const { filters } = req.postDataJSON() as { filters: StubFilter[] };
      return json(route, { status: "ok", data: applyFilters(GAMES, filters) });
    }
    return json(route, { status: "ok", data: GAMES });
  });
  // The shelf view (the toggle's other side) loads through these.
  await page.route("**/api/board-game-boxes**", (route) =>
    json(route, { status: "ok", data: [] }),
  );
  await page.route("**/api/filters/**", (route) =>
    json(route, { status: "ok", data: FILTER_SPEC }),
  );
  await page.route("**/api/custom-fields/entity/boardGame", (route) =>
    json(route, { status: "ok", data: FIELDS }),
  );
  await page.route("**/api/custom-fields/entity/boardGameBox", (route) =>
    json(route, { status: "ok", data: [] }),
  );
}

// The mass modes and the default board-games view are loaded server-side, so
// page.route can't stub them. Pin the modes off and the default view to list
// (the bare /board-games assertions below assume it) — keep every board spec
// pinning these same values to avoid clashing writes to the shared backend
// state (see toys.spec.ts). The standard-field columns are pinned to all-shown
// (the default) because these specs assert on them.
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
  await stubBoardGames(page);
});

test("is reachable from the sidebar and lists the board games", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Board Games" }).click();

  await expect(page).toHaveURL("/board-games");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("BOARD GAMES");
  await expect(
    page.getByRole("heading", { level: 2, name: "2 Board Games" }),
  ).toBeVisible();

  await expect(page.getByText("Set-A-Watch", { exact: true })).toBeVisible();
  await expect(page.getByText("Jekyll vs Hyde", { exact: true })).toBeVisible();
});

test("shows Title + Boxes + custom-field columns, with no System column", async ({
  page,
}) => {
  await page.goto("/board-games");

  await expect(page.getByRole("columnheader", { name: "Title" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Boxes" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Has App" })).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Min Players" }),
  ).toBeVisible();
  // Board games have no system relationship.
  await expect(page.getByRole("columnheader", { name: "System" })).toHaveCount(0);
});

test("shows each game's box count", async ({ page }) => {
  await page.goto("/board-games");

  const watchRow = page.getByRole("row").filter({ hasText: "Set-A-Watch" });
  await expect(watchRow.getByText("2", { exact: true })).toBeVisible();

  const jekyllRow = page.getByRole("row").filter({ hasText: "Jekyll vs Hyde" });
  await expect(jekyllRow.getByText("0", { exact: true })).toBeVisible();
});

test("filters the rows via the search box on Enter", async ({ page }) => {
  await page.goto("/board-games");
  await expect(page.getByText("Set-A-Watch", { exact: true })).toBeVisible();

  const box = page.getByRole("searchbox", { name: "Search board games" });
  await box.fill("jekyll");
  await box.press("Enter");

  // The text becomes a title-contains chip and the box clears.
  await expect(page.getByRole("button", { name: "Edit Title filter" })).toBeVisible();
  await expect(box).toHaveValue("");

  await expect(page.getByText("Jekyll vs Hyde", { exact: true })).toBeVisible();
  await expect(page.getByText("Set-A-Watch", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "1 Board Game" }),
  ).toBeVisible();
});

test("offers no New button and no per-row delete controls", async ({ page }) => {
  await page.goto("/board-games");
  await expect(page.getByText("Set-A-Watch", { exact: true })).toBeVisible();

  // Board games are created and deleted through board game boxes, so the list
  // is read/edit only: filtering is available but New and Delete are not.
  await expect(page.getByRole("button", { name: "Add filter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New" })).toHaveCount(0);

  const row = page.getByRole("row").filter({ hasText: "Set-A-Watch" });
  await row.hover();
  await expect(row.getByRole("button", { name: /^Delete / })).toHaveCount(0);
});

// The detail page fetches its game server-side (Playwright's page.route can't
// stub that), so this smoke test runs against the live dev backend's game #1;
// the deterministic edit-logic coverage lives in __tests__/BoardGameDetail.test.tsx.
test("the board game detail page shows the Fields and Boxes cards and links back", async ({
  page,
}) => {
  await page.goto("/board-games/1");

  // The Fields card with the fixed Title row is the heart of the screen; the
  // Boxes card lists the game's boxes with a create button.
  await expect(page.getByText("Fields", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Title" })).toBeVisible();
  await expect(page.getByText("Board Game Boxes", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New Board Game Box" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL("/board-games?view=list");
  await expect(
    page.getByRole("heading", { level: 2, name: "2 Board Games" }),
  ).toBeVisible();
});
