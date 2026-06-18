import { test, expect, type Page } from "@playwright/test";

type StubSystem = {
  id: number;
  key: "system";
  name: string;
  generation: number;
  handheld: boolean;
  customFieldValues: {
    customFieldId: number;
    customFieldName: string;
    customFieldType: string;
    value: string;
    valueOptionId: number | null;
  }[];
  createdAt: string;
  updatedAt: string;
  deletedAt: null;
};

type StubFilter = { key: string; field: string; operator: string; operand: string };

const FIELDS = [
  {
    id: 31,
    name: "Release Year",
    type: "number",
    entityKey: "system",
    order: 0,
    options: [],
  },
];

// Mirrors the real /filters/system response, including the all_fields entry —
// the capability marker advertising that sorting is supported. Sort filters
// themselves carry the actual field name, never "all_fields".
const FILTER_SPEC = {
  type: "system_filters",
  fields: {
    name: "text",
    generation: "number",
    handheld: "boolean",
    created_at: "time",
    updated_at: "time",
    all_fields: "sort",
    pagination_fields: "pagination",
    "Release Year": "number",
  },
  filters: {
    name: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    generation: [
      "equals",
      "not_equals",
      "greater_than",
      "greater_than_equal_to",
      "less_than",
      "less_than_equal_to",
    ],
    handheld: ["equals"],
    created_at: ["since", "before"],
    updated_at: ["since", "before"],
    all_fields: ["order_by", "order_by_desc"],
    pagination_fields: ["limit", "offset"],
    "Release Year": [
      "equals",
      "not_equals",
      "greater_than",
      "greater_than_equal_to",
      "less_than",
      "less_than_equal_to",
    ],
  },
};

function system(
  id: number,
  name: string,
  generation: number,
  releaseYear: string,
): StubSystem {
  return {
    id,
    key: "system",
    name,
    generation,
    handheld: false,
    customFieldValues: [
      {
        customFieldId: 31,
        customFieldName: "Release Year",
        customFieldType: "number",
        value: releaseYear,
        valueOptionId: null,
      },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  };
}

// Default (backend) order is intentionally not alphabetical or by year, so a
// sorted order is distinguishable from the unsorted one.
const SYSTEMS: StubSystem[] = [
  system(1, "NES", 3, "1985"),
  system(2, "SNES", 4, "1990"),
  system(3, "Game Boy", 4, "1989"),
];

function valueOf(s: StubSystem, field: string): string {
  if (field === "name") return s.name;
  if (field === "generation") return String(s.generation);
  if (field === "handheld") return String(s.handheld);
  return (
    s.customFieldValues.find((v) => v.customFieldName === field)?.value ?? ""
  );
}

// Apply the regular (non-sort) filters; only the operators these tests use.
function applyFilters(list: StubSystem[], filters: StubFilter[]): StubSystem[] {
  return filters.reduce<StubSystem[]>((out, f) => {
    return out.filter((s) => {
      const raw = valueOf(s, f.field);
      switch (f.operator) {
        case "equals":
          return raw.toLowerCase() === f.operand.toLowerCase();
        case "contains":
          return raw.toLowerCase().includes(f.operand.toLowerCase());
        case "greater_than":
          return Number(raw) > Number(f.operand);
        case "less_than":
          return Number(raw) < Number(f.operand);
        default:
          return true;
      }
    });
  }, list);
}

// Apply the sort filters (operator order_by/order_by_desc; the field names the
// sorted-by column) the way the backend does: first entry is the primary sort,
// later entries break ties. Numeric values compare numerically, everything
// else lexically.
function applySorts(list: StubSystem[], sorts: StubFilter[]): StubSystem[] {
  if (sorts.length === 0) return list;
  const sorted = [...list];
  sorted.sort((a, b) => {
    for (const s of sorts) {
      const av = valueOf(a, s.field);
      const bv = valueOf(b, s.field);
      const an = Number(av);
      const bn = Number(bv);
      const numeric = av !== "" && bv !== "" && !Number.isNaN(an) && !Number.isNaN(bn);
      const cmp = numeric ? an - bn : av.localeCompare(bv);
      if (cmp !== 0) return s.operator === "order_by_desc" ? -cmp : cmp;
    }
    return 0;
  });
  return sorted;
}

async function stub(page: Page) {
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
      const isSort = (f: StubFilter) =>
        f.operator === "order_by" || f.operator === "order_by_desc";
      const sorts = (filters ?? []).filter(isSort);
      const plain = (filters ?? []).filter((f) => !isSort(f));
      return json(route, {
        status: "ok",
        data: applySorts(applyFilters(SYSTEMS, plain), sorts),
      });
    }
    return json(route, { status: "ok", data: SYSTEMS });
  });
  await page.route("**/api/filters/system", (route) =>
    json(route, { status: "ok", data: FILTER_SPEC }),
  );
  // No stored default sorts, so these specs exercise the plain (unseeded)
  // sort flow regardless of what the shared backend's metadata holds.
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
  await page.route("**/api/custom-fields/entity/system", (route) =>
    json(route, { status: "ok", data: FIELDS }),
  );
}

// ui_settings load server-side (page.route can't stub them); pin both modes off
// so the grid renders in its normal (non-mass) form. Shared backend state, so
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

// The Name column is the grid's first cell, so the first-cell texts read out
// the current row order.
function names(page: Page) {
  return page.locator("tbody tr td:first-child");
}

async function openSortPopover(page: Page) {
  await page.getByRole("button", { name: "Sort", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sort options" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("sorts by a custom field, descending", async ({ page }) => {
  await page.goto("/systems");
  await expect(names(page)).toHaveText(["NES", "SNES", "Game Boy"]);

  const dialog = await openSortPopover(page);
  await dialog.getByRole("button", { name: "Add sort" }).click();
  // The new level defaults to the first field (Name); switch it to the custom
  // Release Year field and flip the direction.
  await dialog.getByRole("button", { name: "Sort field 1" }).click();
  await page.getByRole("option", { name: "Release Year", exact: true }).click();
  await dialog
    .getByRole("radiogroup", { name: "Sort direction 1" })
    .getByRole("radio", { name: "Desc" })
    .click();

  await expect(names(page)).toHaveText(["SNES", "Game Boy", "NES"]);
});

test("a second level breaks ties left by the first", async ({ page }) => {
  await page.goto("/systems");
  const dialog = await openSortPopover(page);

  // Level 1: Generation descending (SNES and Game Boy tie at 4).
  await dialog.getByRole("button", { name: "Add sort" }).click();
  await dialog.getByRole("button", { name: "Sort field 1" }).click();
  await page.getByRole("option", { name: "Generation", exact: true }).click();
  await dialog
    .getByRole("radiogroup", { name: "Sort direction 1" })
    .getByRole("radio", { name: "Desc" })
    .click();

  // Level 2 defaults to Name ascending, breaking the tie alphabetically.
  await dialog.getByRole("button", { name: "Add sort" }).click();
  await expect(dialog.getByText("then by")).toBeVisible();

  await expect(names(page)).toHaveText(["Game Boy", "SNES", "NES"]);

  // Flipping the tiebreaker to descending swaps the tied pair.
  await dialog
    .getByRole("radiogroup", { name: "Sort direction 2" })
    .getByRole("radio", { name: "Desc" })
    .click();
  await expect(names(page)).toHaveText(["SNES", "Game Boy", "NES"]);
});

test("the Sort button shows the active level count", async ({ page }) => {
  await page.goto("/systems");
  const dialog = await openSortPopover(page);
  await dialog.getByRole("button", { name: "Add sort" }).click();
  await dialog.getByRole("button", { name: "Add sort" }).click();

  await expect(
    page.getByRole("button", { name: "Sort", exact: true }),
  ).toContainText("2");
});

test("clearing sorting restores the default order", async ({ page }) => {
  await page.goto("/systems");
  const dialog = await openSortPopover(page);
  await dialog.getByRole("button", { name: "Add sort" }).click();
  await dialog.getByRole("button", { name: "Sort field 1" }).click();
  await page.getByRole("option", { name: "Release Year", exact: true }).click();
  await dialog
    .getByRole("radiogroup", { name: "Sort direction 1" })
    .getByRole("radio", { name: "Desc" })
    .click();
  await expect(names(page)).toHaveText(["SNES", "Game Boy", "NES"]);

  await dialog.getByRole("button", { name: "Clear sorting" }).click();

  await expect(names(page)).toHaveText(["NES", "SNES", "Game Boy"]);
  await expect(
    dialog.getByText("Add sort criteria to override default sort."),
  ).toBeVisible();
});

test("sorting composes with an active filter", async ({ page }) => {
  await page.goto("/systems");

  // Filter to generation 4, then sort by Name ascending.
  await page.getByRole("button", { name: "Add filter" }).click();
  const editor = page.getByRole("dialog", { name: "Add filter" });
  await editor.getByRole("button", { name: "Filter field" }).click();
  await page.getByRole("option", { name: "Generation", exact: true }).click();
  await editor.getByRole("spinbutton", { name: "Generation value" }).fill("4");
  await editor.getByRole("button", { name: "Add" }).click();
  await expect(names(page)).toHaveText(["SNES", "Game Boy"]);

  const dialog = await openSortPopover(page);
  await dialog.getByRole("button", { name: "Add sort" }).click();

  await expect(names(page)).toHaveText(["Game Boy", "SNES"]);
});
