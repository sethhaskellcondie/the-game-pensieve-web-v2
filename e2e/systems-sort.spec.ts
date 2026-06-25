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
  {
    id: 41,
    name: "Region",
    type: "dropdown",
    entityKey: "system",
    order: 1,
    // The display order (Japan, North America, Europe) is deliberately neither
    // alphabetical nor option-id order, so a sort by display order is
    // distinguishable from one by the value text or the option id.
    options: [
      { id: 53, customFieldId: 41, name: "Japan", isDefault: false, order: 0 },
      { id: 51, customFieldId: 41, name: "North America", isDefault: false, order: 1 },
      { id: 52, customFieldId: 41, name: "Europe", isDefault: false, order: 2 },
    ],
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
    Region: "dropdown",
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
    // Enum custom fields match by option id and now also advertise sorting.
    Region: ["equals", "not_equals", "order_by", "order_by_desc"],
  },
};

function system(
  id: number,
  name: string,
  generation: number,
  releaseYear: string,
  regionOptionId: number,
  regionName: string,
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
      {
        customFieldId: 41,
        customFieldName: "Region",
        customFieldType: "dropdown",
        value: regionName,
        valueOptionId: regionOptionId,
      },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  };
}

// Default (backend) order is intentionally not alphabetical or by year, so a
// sorted order is distinguishable from the unsorted one. The Region options
// (Japan, North America, Europe) are assigned so their display order differs
// from the rows' default, name, and option-id orders.
const SYSTEMS: StubSystem[] = [
  system(1, "NES", 3, "1985", 53, "Japan"),
  system(2, "SNES", 4, "1990", 52, "Europe"),
  system(3, "Game Boy", 4, "1989", 51, "North America"),
];

// The option-backed ("enum") custom field types, which the backend orders by
// the selected option's display order rather than its value text or id.
const ENUM_TYPES = new Set(["dropdown", "radio_button", "progress_bar"]);

// Per enum field, a lookup from an option's id to its display order, taken from
// the field definitions — the order the backend sorts these fields by.
const OPTION_ORDER = new Map(
  FIELDS.filter((f) => ENUM_TYPES.has(f.type)).map((f) => [
    f.name,
    new Map(f.options.map((o) => [o.id, o.order])),
  ]),
);

function valueOf(s: StubSystem, field: string): string {
  if (field === "name") return s.name;
  if (field === "generation") return String(s.generation);
  if (field === "handheld") return String(s.handheld);
  return (
    s.customFieldValues.find((v) => v.customFieldName === field)?.value ?? ""
  );
}

// The key the backend orders a row by for a given field. Enum custom fields
// order by the selected option's display order; every other field by its
// stored value (compared numerically or lexically downstream).
function sortKeyOf(s: StubSystem, field: string): string {
  const orders = OPTION_ORDER.get(field);
  if (orders) {
    const entry = s.customFieldValues.find((v) => v.customFieldName === field);
    const order =
      entry?.valueOptionId == null ? undefined : orders.get(entry.valueOptionId);
    return order == null ? "" : String(order);
  }
  return valueOf(s, field);
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
      const av = sortKeyOf(a, s.field);
      const bv = sortKeyOf(b, s.field);
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

test("sorts an enum custom field by its option display order", async ({
  page,
}) => {
  await page.goto("/systems");
  await expect(names(page)).toHaveText(["NES", "SNES", "Game Boy"]);

  const dialog = await openSortPopover(page);
  await dialog.getByRole("button", { name: "Add sort" }).click();
  await dialog.getByRole("button", { name: "Sort field 1" }).click();
  await page.getByRole("option", { name: "Region", exact: true }).click();

  // Ascending follows the option display order — Japan (NES) < North America
  // (Game Boy) < Europe (SNES) — not the values' alphabetical or id order.
  await expect(names(page)).toHaveText(["NES", "Game Boy", "SNES"]);

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
