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

// Custom-field definitions (supply the dropdown's options; the spec doesn't).
const FIELDS = [
  {
    id: 12,
    name: "Region",
    type: "dropdown",
    entityKey: "system",
    order: 0,
    options: [
      { id: 21, customFieldId: 12, name: "NTSC", isDefault: true, order: 0 },
      { id: 22, customFieldId: 12, name: "PAL", isDefault: false, order: 1 },
    ],
  },
];

// Mirrors the real /filters/system response: standard fields (name, the numeric
// generation, the boolean handheld, the two timestamps) plus the custom fields
// keyed by name, each with its operators.
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
    // Enum (option-backed) fields only support identity checks — the backend
    // matches on option id, so the text operators don't apply.
    Region: ["equals", "not_equals"],
  },
};

const SYSTEMS: StubSystem[] = [
  {
    id: 1,
    key: "system",
    name: "NES",
    generation: 3,
    handheld: false,
    customFieldValues: [
      { customFieldId: 12, customFieldName: "Region", customFieldType: "dropdown", value: "NTSC", valueOptionId: 21 },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
  {
    id: 2,
    key: "system",
    name: "Game Boy",
    generation: 4,
    handheld: true,
    customFieldValues: [
      { customFieldId: 12, customFieldName: "Region", customFieldType: "dropdown", value: "PAL", valueOptionId: 22 },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

// The option-backed ("enum") custom field types, whose filters match on the
// selected option's id rather than its name text.
const ENUM_TYPES = new Set(["dropdown", "radio_button", "progress_bar"]);

// What the backend matches a filter operand against: enum custom fields by the
// entry's valueOptionId (the UI sends the option's id, e.g. "22"), everything
// else by its text value.
function filterValueOf(system: StubSystem, field: string): string {
  if (field === "name") return system.name;
  if (field === "generation") return String(system.generation);
  if (field === "handheld") return String(system.handheld);
  const entry = system.customFieldValues.find(
    (v) => v.customFieldName === field,
  );
  if (!entry) return "";
  if (ENUM_TYPES.has(entry.customFieldType)) {
    return entry.valueOptionId == null ? "" : String(entry.valueOptionId);
  }
  return entry.value;
}

function applyFilters(list: StubSystem[], filters: StubFilter[]): StubSystem[] {
  return (filters ?? []).reduce<StubSystem[]>((out, f) => {
    return out.filter((s) => {
      const raw = filterValueOf(s, f.field);
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
      return json(route, { status: "ok", data: applyFilters(SYSTEMS, filters) });
    }
    return json(route, { status: "ok", data: SYSTEMS });
  });
  await page.route("**/api/filters/system", (route) =>
    json(route, { status: "ok", data: FILTER_SPEC }),
  );
  await page.route("**/api/custom-fields/entity/system", (route) =>
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

// Open the add-filter editor and build a Generation <operator> <value> filter
// on the standard numeric field.
async function addGenerationFilter(
  page: Page,
  operatorLabel: string,
  value: string,
) {
  await page.getByRole("button", { name: "Add filter" }).click();
  const editor = page.getByRole("dialog", { name: "Add filter" });
  await expect(editor).toBeVisible();

  await editor.getByRole("button", { name: "Filter field" }).click();
  await page.getByRole("option", { name: "Generation", exact: true }).click();

  await editor.getByRole("button", { name: "Filter operator" }).click();
  await page.getByRole("option", { name: operatorLabel, exact: true }).click();

  await editor.getByRole("spinbutton", { name: "Generation value" }).fill(value);
  await editor.getByRole("button", { name: "Add" }).click();
}

test("offers each spec field exactly once, with only real standard fields", async ({
  page,
}) => {
  await page.goto("/systems");
  await page.getByRole("button", { name: "Add filter" }).click();

  await page
    .getByRole("dialog", { name: "Add filter" })
    .getByRole("button", { name: "Filter field" })
    .click();
  const listbox = page.getByRole("listbox", { name: "Filter field" });

  // Exactly the spec's filterable fields, no duplicates: sort/pagination and the
  // timestamp (time) fields are dropped, and custom fields are merged in once.
  await expect(listbox.getByRole("option")).toHaveCount(4);
  for (const name of ["Name", "Generation", "Handheld", "Region"]) {
    await expect(listbox.getByRole("option", { name, exact: true })).toHaveCount(1);
  }
  for (const name of ["Created At", "Updated At"]) {
    await expect(listbox.getByRole("option", { name, exact: true })).toHaveCount(0);
  }
});

test("filters on the standard numeric generation field with a comparison operator", async ({
  page,
}) => {
  await page.goto("/systems");
  await expect(page.getByText("NES", { exact: true })).toBeVisible();

  await addGenerationFilter(page, ">", "3");

  // Game Boy is generation 4 (> 3); NES is 3.
  await expect(page.getByRole("button", { name: "Edit Generation filter" })).toBeVisible();
  await expect(page.getByText("Game Boy", { exact: true })).toBeVisible();
  await expect(page.getByText("NES", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "1 System" })).toBeVisible();
});

test("filters on the standard boolean handheld field via the Yes/No picker", async ({
  page,
}) => {
  await page.goto("/systems");
  await expect(page.getByText("NES", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add filter" }).click();
  const editor = page.getByRole("dialog", { name: "Add filter" });
  await editor.getByRole("button", { name: "Filter field" }).click();
  await page.getByRole("option", { name: "Handheld", exact: true }).click();
  // Handheld only supports "is"; the value control is a Yes/No radio pair.
  await editor
    .getByRole("radiogroup", { name: "Handheld value" })
    .getByRole("radio", { name: "Yes" })
    .click();
  await editor.getByRole("button", { name: "Add" }).click();

  await expect(page.getByText("Game Boy", { exact: true })).toBeVisible();
  await expect(page.getByText("NES", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "1 System" })).toBeVisible();
});

test("filters on a dropdown custom field via its option picker", async ({
  page,
}) => {
  await page.goto("/systems");
  const editor = page.getByRole("dialog", { name: "Add filter" });

  await page.getByRole("button", { name: "Add filter" }).click();
  await editor.getByRole("button", { name: "Filter field" }).click();
  await page.getByRole("option", { name: "Region", exact: true }).click();
  // Operator defaults to "is"; the value control is an option picker.
  await editor.getByRole("button", { name: "Region value" }).click();
  await page.getByRole("option", { name: "PAL", exact: true }).click();
  await editor.getByRole("button", { name: "Add" }).click();

  // The filter is sent with the option's id as its operand (the stub matches
  // on valueOptionId), but the chip shows the option's name.
  await expect(page.getByRole("button", { name: "Edit Region filter" })).toContainText(
    "PAL",
  );
  await expect(page.getByText("Game Boy", { exact: true })).toBeVisible();
  await expect(page.getByText("NES", { exact: true })).toHaveCount(0);
});

test("removing a filter restores the full list", async ({ page }) => {
  await page.goto("/systems");
  await addGenerationFilter(page, ">", "3");
  await expect(page.getByRole("heading", { level: 2, name: "1 System" })).toBeVisible();

  await page.getByRole("button", { name: "Remove Generation filter" }).click();

  await expect(page.getByText("NES", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "2 Systems" })).toBeVisible();
});

test("editing a filter re-runs the search", async ({ page }) => {
  await page.goto("/systems");
  await addGenerationFilter(page, ">", "3");
  await expect(page.getByRole("heading", { level: 2, name: "1 System" })).toBeVisible();

  await page.getByRole("button", { name: "Edit Generation filter" }).click();
  const editor = page.getByRole("dialog", { name: "Edit filter" });
  await editor.getByRole("button", { name: "Filter operator" }).click();
  await page.getByRole("option", { name: "<", exact: true }).click();
  await editor.getByRole("spinbutton", { name: "Generation value" }).fill("4");
  await editor.getByRole("button", { name: "Update" }).click();

  // Now generation < 4 matches NES instead.
  await expect(page.getByText("NES", { exact: true })).toBeVisible();
  await expect(page.getByText("Game Boy", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "1 System" })).toBeVisible();
});

test("the search box commits a name-contains chip on Enter and clears", async ({
  page,
}) => {
  await page.goto("/systems");
  await expect(page.getByText("NES", { exact: true })).toBeVisible();

  const box = page.getByRole("searchbox", { name: "Search systems" });
  await box.fill("game");
  await box.press("Enter");

  await expect(page.getByRole("button", { name: "Edit Name filter" })).toBeVisible();
  await expect(box).toHaveValue("");
  await expect(page.getByText("Game Boy", { exact: true })).toBeVisible();
  await expect(page.getByText("NES", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "1 System" })).toBeVisible();
});
