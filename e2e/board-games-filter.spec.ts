import { test, expect, type Page } from "@playwright/test";

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
    name: "Condition",
    type: "dropdown",
    entityKey: "boardGameBox",
    order: 0,
    options: [
      { id: 21, customFieldId: 12, name: "Mint", isDefault: true, order: 0 },
      { id: 22, customFieldId: 12, name: "Worn", isDefault: false, order: 1 },
    ],
  },
];

// Mirrors the real /filters/boardGameBox response: standard fields (title, the
// two boolean expansion flags, the two timestamps) plus the custom fields
// keyed by name, each with its operators. No relationship (system-kind)
// fields — board game boxes can't be filtered by their linked game.
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
    Condition: "dropdown",
  },
  filters: {
    title: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    is_expansion: ["equals"],
    is_stand_alone: ["equals"],
    created_at: ["since", "before"],
    updated_at: ["since", "before"],
    all_fields: ["order_by", "order_by_desc"],
    pagination_fields: ["limit", "offset"],
    Condition: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
  },
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

const BOXES: StubBox[] = [
  {
    id: 31,
    key: "boardGameBox",
    title: "Set-A-Watch Base Box",
    isExpansion: false,
    isStandAlone: true,
    baseSetId: null,
    boardGame: slimGame(41, "Set-A-Watch"),
    customFieldValues: [
      { customFieldId: 12, customFieldName: "Condition", customFieldType: "dropdown", value: "Mint" },
    ],
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
    boardGame: slimGame(41, "Set-A-Watch"),
    customFieldValues: [
      { customFieldId: 12, customFieldName: "Condition", customFieldType: "dropdown", value: "Worn" },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

function valueOf(box: StubBox, field: string): string {
  if (field === "title") return box.title;
  if (field === "is_expansion") return String(box.isExpansion);
  if (field === "is_stand_alone") return String(box.isStandAlone);
  return (
    box.customFieldValues.find((v) => v.customFieldName === field)?.value ?? ""
  );
}

function applyFilters(list: StubBox[], filters: StubFilter[]): StubBox[] {
  return (filters ?? []).reduce<StubBox[]>((out, f) => {
    return out.filter((box) => {
      const a = valueOf(box, f.field).toLowerCase();
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

  await page.route("**/api/board-game-boxes/search", (route) => {
    const { filters } = route.request().postDataJSON() as {
      filters: StubFilter[];
    };
    return json(route, { status: "ok", data: applyFilters(BOXES, filters) });
  });
  await page.route("**/api/board-games**", (route) =>
    json(route, { status: "ok", data: [] }),
  );
  await page.route("**/api/filters/boardGameBox", (route) =>
    json(route, { status: "ok", data: FILTER_SPEC }),
  );
  await page.route("**/api/custom-fields/entity/boardGameBox", (route) =>
    json(route, { status: "ok", data: FIELDS }),
  );
  await page.route("**/api/custom-fields/entity/boardGame", (route) =>
    json(route, { status: "ok", data: [] }),
  );
}

// ui_settings load server-side (page.route can't stub them); pin both modes off
// so the bar renders in its normal (non-mass) form, and the default view to
// list — the same values every other board spec pins, to avoid clashing writes
// to the shared backend state (see toys.spec.ts).
async function pinNormalMode(page: Page) {
  const current = await (await page.request.get("/api/ui-settings")).json();
  await page.request.post("/api/ui-settings", {
    data: {
      ...current,
      massInputMode: false,
      massEditMode: false,
      boardGamesDefaultView: "list",
    },
  });
}

test.beforeEach(async ({ page }) => {
  await pinNormalMode(page);
  await stub(page);
});

test("offers each spec field exactly once, with only real standard fields", async ({
  page,
}) => {
  await page.goto("/board-games?view=shelf");
  await page.getByRole("button", { name: "Add filter" }).click();

  await page
    .getByRole("dialog", { name: "Add filter" })
    .getByRole("button", { name: "Filter field" })
    .click();
  const listbox = page.getByRole("listbox", { name: "Filter field" });

  // Exactly the spec's filterable fields, no duplicates: sort/pagination and
  // the timestamp (time) fields are dropped, the boolean flags surface with
  // human labels, and custom fields are merged in once. There is no
  // relationship field (no Board Game / Base Set filtering).
  await expect(listbox.getByRole("option")).toHaveCount(4);
  for (const name of ["Title", "Is Expansion", "Is Stand Alone", "Condition"]) {
    await expect(listbox.getByRole("option", { name, exact: true })).toHaveCount(1);
  }
  for (const name of ["Created At", "Updated At", "Board Game", "Base Set"]) {
    await expect(listbox.getByRole("option", { name, exact: true })).toHaveCount(0);
  }
});

test("filters on the is_expansion boolean field via the Yes/No picker", async ({
  page,
}) => {
  await page.goto("/board-games?view=shelf");
  // The base box's Condition value is unique to its row ("Set-A-Watch Base
  // Box" itself also shows in the expansion row's Base Set cell).
  await expect(page.getByText("Mint", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add filter" }).click();
  const editor = page.getByRole("dialog", { name: "Add filter" });
  await editor.getByRole("button", { name: "Filter field" }).click();
  await page.getByRole("option", { name: "Is Expansion", exact: true }).click();
  // is_expansion only supports "is"; the value control is a Yes/No radio pair
  // defaulting to Yes.
  await editor
    .getByRole("radiogroup", { name: "Is Expansion value" })
    .getByRole("radio", { name: "Yes" })
    .click();
  await editor.getByRole("button", { name: "Add" }).click();

  // Only the expansion remains, and the chip reads as Yes.
  await expect(
    page.getByText("Set-A-Watch Doomed Run", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Mint", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "1 Board Game Box" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit Is Expansion filter" }),
  ).toContainText("Yes");
});

test("filters on a dropdown custom field via its option picker", async ({
  page,
}) => {
  await page.goto("/board-games?view=shelf");
  const editor = page.getByRole("dialog", { name: "Add filter" });

  await page.getByRole("button", { name: "Add filter" }).click();
  await editor.getByRole("button", { name: "Filter field" }).click();
  await page.getByRole("option", { name: "Condition", exact: true }).click();
  // Operator defaults to "is"; the value control is an option picker.
  await editor.getByRole("button", { name: "Condition value" }).click();
  await page.getByRole("option", { name: "Worn", exact: true }).click();
  await editor.getByRole("button", { name: "Add" }).click();

  await expect(
    page.getByText("Set-A-Watch Doomed Run", { exact: true }),
  ).toBeVisible();
  // The base box's row (its unique Condition value with it) is gone.
  await expect(page.getByText("Mint", { exact: true })).toHaveCount(0);
});

test("removing a filter restores the full list", async ({ page }) => {
  await page.goto("/board-games?view=shelf");
  await expect(page.getByText("Mint", { exact: true })).toBeVisible();

  const box = page.getByRole("searchbox", { name: "Search board game boxes" });
  await box.fill("doomed");
  await box.press("Enter");
  await expect(
    page.getByRole("heading", { level: 2, name: "1 Board Game Box" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Remove Title filter" }).click();

  await expect(page.getByText("Mint", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "2 Board Game Boxes" }),
  ).toBeVisible();
});
