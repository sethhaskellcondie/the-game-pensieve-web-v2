import { test, expect, type Page } from "@playwright/test";

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

type StubFilter = { key: string; field: string; operator: string; operand: string };

// Custom-field definitions (supply the dropdown's options; the spec doesn't).
const FIELDS = [
  {
    id: 12,
    name: "Genre",
    type: "dropdown",
    entityKey: "videoGame",
    order: 0,
    options: [
      { id: 21, customFieldId: 12, name: "Action", isDefault: true, order: 0 },
      { id: 22, customFieldId: 12, name: "RPG", isDefault: false, order: 1 },
    ],
  },
];

// Mirrors the real /filters/videoGame response: standard fields (title, the
// system_id "system" field, the two timestamps) plus the custom fields keyed by
// name, each with its operators.
const FILTER_SPEC = {
  type: "videoGame_filters",
  fields: {
    title: "text",
    system_id: "system",
    created_at: "time",
    updated_at: "time",
    all_fields: "sort",
    pagination_fields: "pagination",
    Genre: "dropdown",
  },
  filters: {
    title: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    system_id: ["equals", "not_equals"],
    created_at: ["since", "before"],
    updated_at: ["since", "before"],
    all_fields: ["order_by", "order_by_desc"],
    pagination_fields: ["limit", "offset"],
    Genre: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
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
    videoGameBoxes: [],
    customFieldValues: [
      { customFieldId: 12, customFieldName: "Genre", customFieldType: "dropdown", value: "Action" },
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
      { customFieldId: 12, customFieldName: "Genre", customFieldType: "dropdown", value: "RPG" },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

function valueOf(game: StubGame, field: string): string {
  if (field === "title") return game.title;
  // The System filter sends the system's id as its operand.
  if (field === "system_id") return String(game.system.id);
  return (
    game.customFieldValues.find((v) => v.customFieldName === field)?.value ?? ""
  );
}

function applyFilters(list: StubGame[], filters: StubFilter[]): StubGame[] {
  return (filters ?? []).reduce<StubGame[]>((out, f) => {
    return out.filter((g) => {
      const a = valueOf(g, f.field).toLowerCase();
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

async function stub(page: Page) {
  const json = (route: Parameters<Parameters<Page["route"]>[1]>[0], body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await page.route("**/api/video-games**", (route) => {
    const req = route.request();
    if (req.url().includes("/search") && req.method() === "POST") {
      const { filters } = req.postDataJSON() as { filters: StubFilter[] };
      return json(route, { status: "ok", data: applyFilters(GAMES, filters) });
    }
    return json(route, { status: "ok", data: GAMES });
  });
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

// ui_settings load server-side (page.route can't stub them); pin both modes off
// so the bar renders in its normal (non-mass) form. Shared backend state, so
// every spec touching these settings pins the same values — see toys.spec.ts.
async function pinNormalMode(page: Page) {
  const current = await (await page.request.get("/api/ui-settings")).json();
  await page.request.post("/api/ui-settings", {
    data: { ...current, massInputMode: false, massEditMode: false },
  });
}

test.beforeEach(async ({ page }) => {
  await pinNormalMode(page);
  await stub(page);
});

// Open the add-filter editor and build a System <operator> <system name> filter
// through the system-name listbox.
async function addSystemFilter(
  page: Page,
  operatorLabel: string,
  systemName: string,
) {
  await page.getByRole("button", { name: "Add filter" }).click();
  const editor = page.getByRole("dialog", { name: "Add filter" });
  await expect(editor).toBeVisible();

  await editor.getByRole("button", { name: "Filter field" }).click();
  await page.getByRole("option", { name: "System", exact: true }).click();

  await editor.getByRole("button", { name: "Filter operator" }).click();
  await page.getByRole("option", { name: operatorLabel, exact: true }).click();

  await editor.getByRole("button", { name: "System value" }).click();
  await page.getByRole("option", { name: systemName, exact: true }).click();
  await editor.getByRole("button", { name: "Add" }).click();
}

test("offers each spec field exactly once, with only real standard fields", async ({
  page,
}) => {
  await page.goto("/video-games");
  await page.getByRole("button", { name: "Add filter" }).click();

  await page
    .getByRole("dialog", { name: "Add filter" })
    .getByRole("button", { name: "Filter field" })
    .click();
  const listbox = page.getByRole("listbox", { name: "Filter field" });

  // Exactly the spec's filterable fields, no duplicates: sort/pagination and the
  // timestamp (time) fields are dropped, system_id surfaces as "System", and
  // custom fields are merged in once.
  await expect(listbox.getByRole("option")).toHaveCount(3);
  for (const name of ["Title", "System", "Genre"]) {
    await expect(listbox.getByRole("option", { name, exact: true })).toHaveCount(1);
  }
  for (const name of ["Created At", "Updated At", "System Id"]) {
    await expect(listbox.getByRole("option", { name, exact: true })).toHaveCount(0);
  }
});

test("filters by system through a listbox of system names", async ({ page }) => {
  await page.goto("/video-games");
  await expect(page.getByText("Super Mario Bros.", { exact: true })).toBeVisible();

  await addSystemFilter(page, "is", "NES");

  // The chip shows the system's name, not its numeric id.
  const chip = page.getByRole("button", { name: "Edit System filter" });
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("NES");

  await expect(page.getByText("Super Mario Bros.", { exact: true })).toBeVisible();
  await expect(page.getByText("Chrono Trigger", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "1 Video Game" }),
  ).toBeVisible();
});

test("filters by system with the is-not operator", async ({ page }) => {
  await page.goto("/video-games");
  await expect(page.getByText("Super Mario Bros.", { exact: true })).toBeVisible();

  await addSystemFilter(page, "is not", "NES");

  await expect(page.getByText("Chrono Trigger", { exact: true })).toBeVisible();
  await expect(page.getByText("Super Mario Bros.", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "1 Video Game" }),
  ).toBeVisible();
});

test("filters on a dropdown custom field via its option picker", async ({
  page,
}) => {
  await page.goto("/video-games");
  const editor = page.getByRole("dialog", { name: "Add filter" });

  await page.getByRole("button", { name: "Add filter" }).click();
  await editor.getByRole("button", { name: "Filter field" }).click();
  await page.getByRole("option", { name: "Genre", exact: true }).click();
  // Operator defaults to "is"; the value control is an option picker.
  await editor.getByRole("button", { name: "Genre value" }).click();
  await page.getByRole("option", { name: "RPG", exact: true }).click();
  await editor.getByRole("button", { name: "Add" }).click();

  await expect(page.getByText("Chrono Trigger", { exact: true })).toBeVisible();
  await expect(page.getByText("Super Mario Bros.", { exact: true })).toHaveCount(0);
});

test("removing a filter restores the full list", async ({ page }) => {
  await page.goto("/video-games");
  await addSystemFilter(page, "is", "NES");
  await expect(
    page.getByRole("heading", { level: 2, name: "1 Video Game" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Remove System filter" }).click();

  await expect(page.getByText("Chrono Trigger", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "2 Video Games" }),
  ).toBeVisible();
});

test("editing a filter re-runs the search", async ({ page }) => {
  await page.goto("/video-games");
  await addSystemFilter(page, "is", "NES");
  await expect(
    page.getByRole("heading", { level: 2, name: "1 Video Game" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Edit System filter" }).click();
  const editor = page.getByRole("dialog", { name: "Edit filter" });
  await editor.getByRole("button", { name: "System value" }).click();
  await page.getByRole("option", { name: "SNES", exact: true }).click();
  await editor.getByRole("button", { name: "Update" }).click();

  // Now the SNES game matches instead, and the chip's label follows.
  await expect(page.getByText("Chrono Trigger", { exact: true })).toBeVisible();
  await expect(page.getByText("Super Mario Bros.", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit System filter" }),
  ).toContainText("SNES");
});

test("the search box commits a title-contains chip on Enter and clears", async ({
  page,
}) => {
  await page.goto("/video-games");
  await expect(page.getByText("Super Mario Bros.", { exact: true })).toBeVisible();

  const box = page.getByRole("searchbox", { name: "Search video games" });
  await box.fill("chrono");
  await box.press("Enter");

  await expect(page.getByRole("button", { name: "Edit Title filter" })).toBeVisible();
  await expect(box).toHaveValue("");
  await expect(page.getByText("Chrono Trigger", { exact: true })).toBeVisible();
  await expect(page.getByText("Super Mario Bros.", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "1 Video Game" }),
  ).toBeVisible();
});
