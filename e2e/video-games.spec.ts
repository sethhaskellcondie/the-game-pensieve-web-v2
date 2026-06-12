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

type StubGame = {
  id: number;
  key: "videoGame";
  title: string;
  system: StubSystem;
  videoGameBoxes: { id: number; title: string }[];
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
  { id: 10, name: "Favorite", type: "boolean", entityKey: "videoGame", order: 0, options: [] },
  { id: 11, name: "Hours Played", type: "number", entityKey: "videoGame", order: 1, options: [] },
];

// Mirrors the live /filters/videoGame response shape, including the system_id
// "system" field and the sort/pagination/time pseudo-fields the UI drops.
const FILTER_SPEC = {
  type: "videoGame_filters",
  fields: {
    title: "text",
    system_id: "system",
    created_at: "time",
    updated_at: "time",
    all_fields: "sort",
    pagination_fields: "pagination",
  },
  filters: {
    title: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    system_id: ["equals", "not_equals"],
    created_at: ["since", "before"],
    updated_at: ["since", "before"],
    all_fields: ["order_by", "order_by_desc"],
    pagination_fields: ["limit", "offset"],
  },
};

const SYSTEMS: StubSystem[] = [
  { id: 1, key: "system", name: "NES", generation: 3, handheld: false, customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
  { id: 2, key: "system", name: "SNES", generation: 4, handheld: false, customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
];

const GAMES: StubGame[] = [
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
      { customFieldId: 10, customFieldName: "Favorite", customFieldType: "boolean", value: "true" },
      { customFieldId: 11, customFieldName: "Hours Played", customFieldType: "number", value: "12" },
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
      { customFieldId: 10, customFieldName: "Favorite", customFieldType: "boolean", value: "false" },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

type StubFilter = { key: string; field: string; operator: string; operand: string };

// A small stand-in for the backend's filter matching, enough to drive the
// server-side search in these specs. The system filter matches on the system's
// id (the operand the UI sends), everything else on its text value.
function applyFilters(list: StubGame[], filters: StubFilter[]): StubGame[] {
  return (filters ?? []).reduce<StubGame[]>((out, f) => {
    return out.filter((g) => {
      const raw =
        f.field === "title"
          ? g.title
          : f.field === "system_id"
            ? String(g.system.id)
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

// Stubs the video-game, system, and custom-field proxies so the screen runs
// end-to-end without a live backend.
async function stubVideoGames(page: Page) {
  const json = (route: Parameters<Parameters<Page["route"]>[1]>[0], body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  // The list loads and searches through the POST search endpoint; branch it so a
  // search applies its filters and any other call returns the full list.
  await page.route("**/api/video-games**", (route) => {
    const req = route.request();
    if (req.url().includes("/search") && req.method() === "POST") {
      const { filters } = req.postDataJSON() as { filters: StubFilter[] };
      return json(route, { status: "ok", data: applyFilters(GAMES, filters) });
    }
    return json(route, { status: "ok", data: GAMES });
  });
  // The systems list feeds the System dropdown + filter options.
  await page.route("**/api/systems**", (route) =>
    json(route, { status: "ok", data: SYSTEMS }),
  );
  await page.route("**/api/filters/videoGame", (route) =>
    json(route, { status: "ok", data: FILTER_SPEC }),
  );
  await page.route("**/api/custom-fields/entity/videoGame", (route) =>
    json(route, { status: "ok", data: FIELDS }),
  );
}

// The mass-edit/mass-input modes change how the grid renders, and they're
// loaded server-side in the layout — so page.route can't stub them. These specs
// all assume the normal (non-mass) UI, so pin both off (the same values every
// other spec pins, to avoid clashing writes to the shared backend state); the
// mass-mode behaviors are covered deterministically by the VideoGamesManager
// unit tests. The default view is pinned to list because these specs visit the
// bare /video-games URL and assume the list renders. The standard-field columns
// are pinned to all-shown (the default) because these specs assert on them.
// Other settings are read back and preserved.
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
  await stubVideoGames(page);
});

test("is reachable from the sidebar and lists the video games", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Video Games" }).click();

  await expect(page).toHaveURL("/video-games");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("VIDEO GAMES");
  await expect(
    page.getByRole("heading", { level: 2, name: "2 Video Games" }),
  ).toBeVisible();

  await expect(page.getByText("Super Mario Bros.", { exact: true })).toBeVisible();
  await expect(page.getByText("Chrono Trigger", { exact: true })).toBeVisible();
});

test("shows Title + System + Boxes + custom-field columns in order", async ({
  page,
}) => {
  await page.goto("/video-games");

  await expect(page.getByRole("columnheader", { name: "Title" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "System" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Boxes" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Favorite" })).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Hours Played" }),
  ).toBeVisible();
});

test("shows each game's system name and box count", async ({ page }) => {
  await page.goto("/video-games");

  const marioRow = page.getByRole("row").filter({ hasText: "Super Mario Bros." });
  await expect(marioRow.getByText("NES", { exact: true })).toBeVisible();
  await expect(marioRow.getByText("2", { exact: true })).toBeVisible();

  const chronoRow = page.getByRole("row").filter({ hasText: "Chrono Trigger" });
  await expect(chronoRow.getByText("SNES", { exact: true })).toBeVisible();
  await expect(chronoRow.getByText("0", { exact: true })).toBeVisible();
});

test("filters the rows via the search box on Enter", async ({ page }) => {
  await page.goto("/video-games");
  await expect(page.getByText("Super Mario Bros.", { exact: true })).toBeVisible();

  const box = page.getByRole("searchbox", { name: "Search video games" });
  await box.fill("chrono");
  await box.press("Enter");

  // The text becomes a title-contains chip and the box clears.
  await expect(page.getByRole("button", { name: "Edit Title filter" })).toBeVisible();
  await expect(box).toHaveValue("");

  await expect(page.getByText("Chrono Trigger", { exact: true })).toBeVisible();
  await expect(page.getByText("Super Mario Bros.", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "1 Video Game" }),
  ).toBeVisible();
});

test("offers no New button and no per-row delete controls", async ({ page }) => {
  await page.goto("/video-games");
  await expect(page.getByText("Super Mario Bros.", { exact: true })).toBeVisible();

  // Video games are created and deleted through video game boxes, so the list
  // is read/edit only: filtering is available but New and Delete are not.
  await expect(page.getByRole("button", { name: "Add filter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New" })).toHaveCount(0);

  const row = page.getByRole("row").filter({ hasText: "Super Mario Bros." });
  await row.hover();
  await expect(row.getByRole("button", { name: /^Delete / })).toHaveCount(0);
});

// The detail page fetches its game server-side (Playwright's page.route can't
// stub that), so this smoke test runs against the live dev backend's game #1;
// the deterministic edit-logic coverage lives in __tests__/VideoGameDetail.test.tsx.
test("the video game detail page shows the Fields and Boxes cards and links back", async ({
  page,
}) => {
  await page.goto("/video-games/1");

  // The Fields card with the fixed Title + System rows is the heart of the
  // screen; the Boxes card lists the game's boxes read-only.
  await expect(page.getByText("Fields", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Title" })).toBeVisible();
  await expect(page.getByRole("button", { name: "System" })).toBeVisible();
  await expect(page.getByText("Video Game Boxes", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL("/video-games?view=list");
  await expect(
    page.getByRole("heading", { level: 2, name: "2 Video Games" }),
  ).toBeVisible();
});
