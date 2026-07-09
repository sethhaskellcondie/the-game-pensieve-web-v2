import { test, expect, type Page, type Request } from "@playwright/test";
import { AUTH_STATE } from "./authState";

// Specs for the per-entity default sort options: edited from the Options
// page's Default Sort Options section, stored under the default_sort_options
// metadata key, and applied by a collection page's search until the user picks
// a sort there themselves. The metadata is fetched client-side through
// /api/default-sort-options, so (unlike ui_settings) page.route can stub it.

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

type DefaultSortLevel = { field: string; direction: "asc" | "desc" };

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

// Mirrors the real /filters/system response, including the all_fields sort
// capability marker. The handful of extra custom fields makes the field
// picker's menu taller than its height cap, so the reachability test below
// exercises a menu that has to scroll.
const FILTER_SPEC = {
  type: "system_filters",
  fields: {
    name: "text",
    generation: "number",
    handheld: "boolean",
    all_fields: "sort",
    pagination_fields: "pagination",
    Company: "text",
    "Controller Acquired": "boolean",
    "Retro State": "text",
    "Is Complete": "boolean",
    "Parent Company": "text",
    "Release Year": "number",
  },
  filters: {
    name: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    generation: ["equals", "not_equals", "greater_than", "less_than"],
    handheld: ["equals"],
    all_fields: ["order_by", "order_by_desc"],
    pagination_fields: ["limit", "offset"],
    "Release Year": ["equals", "not_equals", "greater_than", "less_than"],
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

// Apply the sort filters the way the backend does: first entry is the primary
// sort, later entries break ties. Numeric values compare numerically.
function applySorts(list: StubSystem[], sorts: StubFilter[]): StubSystem[] {
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

const NO_DEFAULTS = {
  toy: [],
  system: [],
  videoGame: [],
  videoGameBox: [],
  boardGame: [],
  boardGameBox: [],
};

async function stub(page: Page, systemDefaults: DefaultSortLevel[]) {
  const json = (
    route: Parameters<Parameters<Page["route"]>[1]>[0],
    body: unknown,
  ) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  // Generic fallbacks for the other entities' field lists (the Options page
  // fetches one per entity); registered first so the system-specific stubs
  // below take precedence.
  await page.route("**/api/filters/**", (route) =>
    json(route, {
      status: "ok",
      data: {
        type: "filters",
        fields: {
          name: "text",
          all_fields: "sort",
          pagination_fields: "pagination",
        },
        filters: {},
      },
    }),
  );
  await page.route("**/api/custom-fields/entity/**", (route) =>
    json(route, { status: "ok", data: [] }),
  );
  await page.route("**/api/default-sort-options", (route) => {
    if (route.request().method() === "POST") {
      return json(route, { ok: true });
    }
    return json(route, { ...NO_DEFAULTS, system: systemDefaults });
  });
  await page.route("**/api/systems**", (route) => {
    const req = route.request();
    if (req.url().includes("/search") && req.method() === "POST") {
      const { filters } = req.postDataJSON() as { filters: StubFilter[] };
      const sorts = (filters ?? []).filter(
        (f) => f.operator === "order_by" || f.operator === "order_by_desc",
      );
      return json(route, { status: "ok", data: applySorts(SYSTEMS, sorts) });
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

// ui_settings load server-side (page.route can't stub them); pin both modes
// off so the grid renders in its normal (non-mass) form. Shared backend state,
// so every spec touching these settings pins the same values — see
// toys.spec.ts and systems-sort.spec.ts.
async function pinNormalMode(page: Page) {
  const current = await (await page.request.get("/api/ui-settings")).json();
  await page.request.post("/api/ui-settings", {
    data: { ...current, massInputMode: false, massEditMode: false },
  });
}

// The Name column is the grid's first cell, so the first-cell texts read out
// the current row order.
function names(page: Page) {
  return page.locator("tbody tr td:first-child");
}

test.describe("Options page section", () => {
  // /options requires a logged-in account (guests redirect to /login).
  test.use({ storageState: AUTH_STATE });

  test("edits the Systems default sort and persists it", async ({ page }) => {
    await stub(page, []);
    await page.goto("/options");

    await expect(
      page.getByRole("heading", { name: "Default Sort Options" }),
    ).toBeVisible();

    const button = page.getByRole("button", {
      name: "Default sort for Systems",
    });
    await expect(button).toBeEnabled();
    await button.click();
    const dialog = page.getByRole("dialog", {
      name: "Default sort for Systems options",
    });
    await expect(dialog).toBeVisible();

    // Adding a level writes the full record; the new level defaults to the
    // first field (Name) ascending.
    const persisted = page.waitForRequest(
      (req: Request) =>
        req.url().includes("/api/default-sort-options") &&
        req.method() === "POST",
    );
    await dialog.getByRole("button", { name: "Add sort" }).click();
    const request = await persisted;
    expect(request.postDataJSON().system).toEqual([
      { field: "name", direction: "asc" },
    ]);

    // Confirmed write: the button's count bubble reflects the saved level.
    await expect(button).toContainText("1");
  });

  test("the last field stays reachable when the picker opens near the viewport bottom", async ({
    page,
  }) => {
    // Mirror the reported layout: a short window, scrolled to the bottom of
    // the page, so the field picker's menu has less room below its trigger
    // than its natural height — it must clamp/flip rather than run off-screen.
    await page.setViewportSize({ width: 1055, height: 500 });
    await stub(page, [
      { field: "generation", direction: "asc" },
      { field: "name", direction: "asc" },
    ]);
    await page.goto("/options");
    await page.evaluate(() => {
      const main = document.scrollingElement;
      if (main) main.scrollTop = main.scrollHeight;
    });

    const button = page.getByRole("button", {
      name: "Default sort for Systems",
    });
    await expect(button).toContainText("2");
    await button.click();
    const dialog = page.getByRole("dialog", {
      name: "Default sort for Systems options",
    });
    await dialog.getByRole("button", { name: "Sort field 2" }).click();

    // Release Year is the last option in the menu; picking it persists the
    // second level. Before the menu clamped itself to the viewport this click
    // failed — the option sat off-screen past the bottom edge.
    const persisted = page.waitForRequest(
      (req: Request) =>
        req.url().includes("/api/default-sort-options") &&
        req.method() === "POST",
    );
    await page
      .getByRole("option", { name: "Release Year", exact: true })
      .click();
    const request = await persisted;
    expect(request.postDataJSON().system).toEqual([
      { field: "generation", direction: "asc" },
      { field: "Release Year", direction: "asc" },
    ]);
    await expect(
      dialog.getByRole("button", { name: "Sort field 2" }),
    ).toContainText("Release Year");
  });

  test("shows the stored default levels on load", async ({ page }) => {
    await stub(page, [{ field: "Release Year", direction: "desc" }]);
    await page.goto("/options");

    const button = page.getByRole("button", {
      name: "Default sort for Systems",
    });
    await expect(button).toContainText("1");
    await button.click();
    const dialog = page.getByRole("dialog", {
      name: "Default sort for Systems options",
    });
    await expect(dialog.getByText("Sort by")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Sort field 1" }),
    ).toContainText("Release Year");
    await expect(
      dialog.getByRole("radiogroup", { name: "Sort direction 1" }).getByRole("radio", { name: "Desc" }),
    ).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("Systems page application", () => {
  test.beforeEach(async ({ page }) => {
    await pinNormalMode(page);
  });

  test("the default sort is applied to the initial load", async ({ page }) => {
    await stub(page, [{ field: "Release Year", direction: "desc" }]);
    await page.goto("/systems");

    // Sorted by Release Year descending (1990, 1989, 1985) — not the backend's
    // natural order. The default rides along in the request only; the Sort
    // button stays empty (no level-count bubble, empty-state popover).
    await expect(names(page)).toHaveText(["SNES", "Game Boy", "NES"]);
    const sortButton = page.getByRole("button", { name: "Sort", exact: true });
    await expect(sortButton).not.toContainText("1");
    await sortButton.click();
    await expect(
      page
        .getByRole("dialog", { name: "Sort options" })
        .getByText("Add sort criteria to override default sort."),
    ).toBeVisible();
  });

  test("using the Sort button overrides the default", async ({ page }) => {
    await stub(page, [{ field: "Release Year", direction: "desc" }]);
    await page.goto("/systems");
    await expect(names(page)).toHaveText(["SNES", "Game Boy", "NES"]);

    // Adding a page sort (the first field: Name ascending) replaces the
    // default outright — the request now carries only the user's level.
    await page.getByRole("button", { name: "Sort", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Sort options" });
    await dialog.getByRole("button", { name: "Add sort" }).click();
    await expect(names(page)).toHaveText(["Game Boy", "NES", "SNES"]);

    // Clearing the page's sorting leaves it with no sorts of its own, so the
    // stored default applies again: Release Year descending.
    await dialog.getByRole("button", { name: "Clear sorting" }).click();
    await expect(names(page)).toHaveText(["SNES", "Game Boy", "NES"]);
    await expect(
      page.getByRole("button", { name: "Sort", exact: true }),
    ).not.toContainText("1");
  });

  test("no stored default leaves the natural order", async ({ page }) => {
    await stub(page, []);
    await page.goto("/systems");

    await expect(names(page)).toHaveText(["NES", "SNES", "Game Boy"]);
    await expect(
      page.getByRole("button", { name: "Sort", exact: true }),
    ).not.toContainText("1");
  });
});
