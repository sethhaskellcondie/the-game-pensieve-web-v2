import { test, expect, type Page } from "@playwright/test";

type StubToy = {
  id: number;
  key: "toy";
  name: string;
  set: string;
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

// Custom-field definitions (supply the dropdown's options; the spec doesn't).
const FIELDS = [
  { id: 10, name: "Broken", type: "boolean", entityKey: "toy", order: 0, options: [] },
  { id: 11, name: "Quantity", type: "number", entityKey: "toy", order: 1, options: [] },
  {
    id: 12,
    name: "Series",
    type: "dropdown",
    entityKey: "toy",
    order: 2,
    options: [
      { id: 21, customFieldId: 12, name: "Original", isDefault: true, order: 0 },
      { id: 22, customFieldId: 12, name: "Special", isDefault: false, order: 1 },
    ],
  },
];

// Mirrors the real /filters/toy response: standard fields (name, set, the two
// timestamps) plus the custom fields keyed by name, each with its operators.
const FILTER_SPEC = {
  type: "toy_filters",
  fields: {
    name: "text",
    set: "text",
    created_at: "time",
    updated_at: "time",
    all_fields: "sort",
    pagination_fields: "pagination",
    Broken: "boolean",
    Quantity: "number",
    Series: "dropdown",
  },
  filters: {
    name: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    set: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    created_at: ["since", "before"],
    updated_at: ["since", "before"],
    all_fields: ["order_by", "order_by_desc"],
    pagination_fields: ["limit", "offset"],
    Broken: ["equals"],
    Quantity: [
      "equals",
      "not_equals",
      "greater_than",
      "greater_than_equal_to",
      "less_than",
      "less_than_equal_to",
    ],
    // Enum (option-backed) fields only support identity checks — the backend
    // matches on option id, so the text operators don't apply.
    Series: ["equals", "not_equals"],
  },
};

const TOYS: StubToy[] = [
  {
    id: 1,
    key: "toy",
    name: "R2-D2",
    set: "Star Wars",
    customFieldValues: [
      { customFieldId: 11, customFieldName: "Quantity", customFieldType: "number", value: "10", valueOptionId: null },
      { customFieldId: 12, customFieldName: "Series", customFieldType: "dropdown", value: "Original", valueOptionId: 21 },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 2,
    key: "toy",
    name: "Pikachu",
    set: "Pokemon",
    customFieldValues: [
      { customFieldId: 11, customFieldName: "Quantity", customFieldType: "number", value: "3", valueOptionId: null },
      { customFieldId: 12, customFieldName: "Series", customFieldType: "dropdown", value: "Special", valueOptionId: 22 },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

function valueOf(toy: StubToy, field: string): string {
  if (field === "name") return toy.name;
  if (field === "set") return toy.set;
  return toy.customFieldValues.find((v) => v.customFieldName === field)?.value ?? "";
}

// The option-backed ("enum") custom field types, whose filters match on the
// selected option's id rather than its name text.
const ENUM_TYPES = new Set(["dropdown", "radio_button", "progress_bar"]);

// What the backend matches a filter operand against: enum custom fields by the
// entry's valueOptionId (the UI sends the option's id, e.g. "22"), everything
// else by its text value.
function filterValueOf(toy: StubToy, field: string): string {
  if (field === "name") return toy.name;
  if (field === "set") return toy.set;
  const entry = toy.customFieldValues.find((v) => v.customFieldName === field);
  if (!entry) return "";
  if (ENUM_TYPES.has(entry.customFieldType)) {
    return entry.valueOptionId == null ? "" : String(entry.valueOptionId);
  }
  return entry.value;
}

function applyFilters(list: StubToy[], filters: StubFilter[]): StubToy[] {
  return (filters ?? []).reduce<StubToy[]>((out, f) => {
    return out.filter((t) => {
      const raw = filterValueOf(t, f.field);
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
        case "greater_than":
          return Number(raw) > Number(f.operand);
        case "greater_than_equal_to":
          return Number(raw) >= Number(f.operand);
        case "less_than":
          return Number(raw) < Number(f.operand);
        case "less_than_equal_to":
          return Number(raw) <= Number(f.operand);
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
function applySorts(list: StubToy[], sorts: StubFilter[]): StubToy[] {
  if (sorts.length === 0) return list;
  const sorted = [...list];
  sorted.sort((a, b) => {
    for (const s of sorts) {
      const av = valueOf(a, s.field);
      const bv = valueOf(b, s.field);
      const an = Number(av);
      const bn = Number(bv);
      const numeric =
        av !== "" && bv !== "" && !Number.isNaN(an) && !Number.isNaN(bn);
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

  await page.route("**/api/toys**", (route) => {
    const req = route.request();
    if (req.url().includes("/search") && req.method() === "POST") {
      const { filters } = req.postDataJSON() as { filters: StubFilter[] };
      const isSort = (f: StubFilter) =>
        f.operator === "order_by" || f.operator === "order_by_desc";
      const sorts = (filters ?? []).filter(isSort);
      const plain = (filters ?? []).filter((f) => !isSort(f));
      return json(route, {
        status: "ok",
        data: applySorts(applyFilters(TOYS, plain), sorts),
      });
    }
    return json(route, { status: "ok", data: TOYS });
  });
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
  await page.route("**/api/filters/toy", (route) =>
    json(route, { status: "ok", data: FILTER_SPEC }),
  );
  await page.route("**/api/custom-fields/entity/toy", (route) =>
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

// Open the add-filter editor and build a Set <operator> <value> text filter.
async function addSetFilter(page: Page, operatorLabel: string, value: string) {
  await page.getByRole("button", { name: "Add filter" }).click();
  const editor = page.getByRole("dialog", { name: "Add filter" });
  await expect(editor).toBeVisible();

  await editor.getByRole("button", { name: "Filter field" }).click();
  await page.getByRole("option", { name: "Set" }).click();

  await editor.getByRole("button", { name: "Filter operator" }).click();
  await page.getByRole("option", { name: operatorLabel, exact: true }).click();

  await editor.getByRole("textbox", { name: "Set value" }).fill(value);
  await editor.getByRole("button", { name: "Add" }).click();
}

test("offers each spec field exactly once, with only real standard fields", async ({
  page,
}) => {
  await page.goto("/toys");
  await page.getByRole("button", { name: "Add filter" }).click();

  await page
    .getByRole("dialog", { name: "Add filter" })
    .getByRole("button", { name: "Filter field" })
    .click();
  const listbox = page.getByRole("listbox", { name: "Filter field" });

  // Exactly the spec's filterable fields, no duplicates: sort/pagination and the
  // timestamp (time) fields are dropped, and custom fields no longer leak in as
  // extra "standard" fields.
  await expect(listbox.getByRole("option")).toHaveCount(5);
  for (const name of ["Name", "Set", "Broken", "Quantity", "Series"]) {
    await expect(listbox.getByRole("option", { name, exact: true })).toHaveCount(1);
  }
  for (const name of ["Created At", "Updated At"]) {
    await expect(listbox.getByRole("option", { name, exact: true })).toHaveCount(0);
  }
});

test("adds a filter that narrows the list to the matching toys", async ({
  page,
}) => {
  await page.goto("/toys");
  await expect(page.getByText("R2-D2", { exact: true })).toBeVisible();

  await addSetFilter(page, "is", "Pokemon");

  await expect(page.getByRole("button", { name: "Edit Set filter" })).toBeVisible();
  await expect(page.getByText("Pikachu", { exact: true })).toBeVisible();
  await expect(page.getByText("R2-D2", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "1 Toy" })).toBeVisible();
});

test("filters on a numeric custom field with a comparison operator", async ({
  page,
}) => {
  await page.goto("/toys");
  const editor = page.getByRole("dialog", { name: "Add filter" });

  await page.getByRole("button", { name: "Add filter" }).click();
  await editor.getByRole("button", { name: "Filter field" }).click();
  await page.getByRole("option", { name: "Quantity", exact: true }).click();
  await editor.getByRole("button", { name: "Filter operator" }).click();
  await page.getByRole("option", { name: ">", exact: true }).click();
  await editor.getByRole("spinbutton", { name: "Quantity value" }).fill("5");
  await editor.getByRole("button", { name: "Add" }).click();

  // R2-D2 has Quantity 10 (> 5); Pikachu has 3.
  await expect(page.getByText("R2-D2", { exact: true })).toBeVisible();
  await expect(page.getByText("Pikachu", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "1 Toy" })).toBeVisible();
});

test("filters on a dropdown custom field via its option picker", async ({
  page,
}) => {
  await page.goto("/toys");
  const editor = page.getByRole("dialog", { name: "Add filter" });

  await page.getByRole("button", { name: "Add filter" }).click();
  await editor.getByRole("button", { name: "Filter field" }).click();
  await page.getByRole("option", { name: "Series", exact: true }).click();
  // Operator defaults to "is"; the value control is an option picker.
  await editor.getByRole("button", { name: "Series value" }).click();
  await page.getByRole("option", { name: "Special", exact: true }).click();
  await editor.getByRole("button", { name: "Add" }).click();

  // The filter is sent with the option's id as its operand (the stub matches
  // on valueOptionId), but the chip shows the option's name.
  await expect(page.getByRole("button", { name: "Edit Series filter" })).toContainText(
    "Special",
  );
  await expect(page.getByText("Pikachu", { exact: true })).toBeVisible();
  await expect(page.getByText("R2-D2", { exact: true })).toHaveCount(0);
});

test("removing a filter restores the full list", async ({ page }) => {
  await page.goto("/toys");
  await addSetFilter(page, "is", "Pokemon");
  await expect(page.getByRole("heading", { level: 2, name: "1 Toy" })).toBeVisible();

  await page.getByRole("button", { name: "Remove Set filter" }).click();

  await expect(page.getByText("R2-D2", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "2 Toys" })).toBeVisible();
});

test("editing a filter re-runs the search", async ({ page }) => {
  await page.goto("/toys");
  await addSetFilter(page, "is", "Pokemon");
  await expect(page.getByRole("heading", { level: 2, name: "1 Toy" })).toBeVisible();

  await page.getByRole("button", { name: "Edit Set filter" }).click();
  const editor = page.getByRole("dialog", { name: "Edit filter" });
  await editor.getByRole("textbox", { name: "Set value" }).fill("Star Wars");
  await editor.getByRole("button", { name: "Update" }).click();

  await expect(page.getByText("R2-D2", { exact: true })).toBeVisible();
  await expect(page.getByText("Pikachu", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "1 Toy" })).toBeVisible();
});

test("the search box commits a name-contains chip on Enter and clears", async ({
  page,
}) => {
  await page.goto("/toys");
  await expect(page.getByText("R2-D2", { exact: true })).toBeVisible();

  const box = page.getByRole("searchbox", { name: "Search toys" });
  await box.fill("pika");
  await box.press("Enter");

  await expect(page.getByRole("button", { name: "Edit Name filter" })).toBeVisible();
  await expect(box).toHaveValue("");
  await expect(page.getByText("Pikachu", { exact: true })).toBeVisible();
  await expect(page.getByText("R2-D2", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "1 Toy" })).toBeVisible();
});

test("sorts toys by a custom field via the Sort button", async ({ page }) => {
  await page.goto("/toys");
  const names = page.locator("tbody tr td:first-child");
  await expect(names).toHaveText(["R2-D2", "Pikachu"]);

  await page.getByRole("button", { name: "Sort", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sort options" });
  await dialog.getByRole("button", { name: "Add sort" }).click();
  // The new level defaults to the first field (Name); switch it to the numeric
  // Quantity custom field.
  await dialog.getByRole("button", { name: "Sort field 1" }).click();
  // The enum (dropdown) Series field is not sortable, so the sort picker
  // doesn't offer it.
  await expect(
    page.getByRole("option", { name: "Series", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("option", { name: "Quantity", exact: true }).click();

  // Quantity ascending: Pikachu (3) before R2-D2 (10).
  await expect(names).toHaveText(["Pikachu", "R2-D2"]);

  await dialog
    .getByRole("radiogroup", { name: "Sort direction 1" })
    .getByRole("radio", { name: "Desc" })
    .click();
  await expect(names).toHaveText(["R2-D2", "Pikachu"]);
});
