import { test, expect, type Page } from "@playwright/test";

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
  { id: 10, name: "Modded", type: "boolean", entityKey: "system", order: 0, options: [] },
  { id: 11, name: "Controllers", type: "number", entityKey: "system", order: 1, options: [] },
];

const FILTER_SPEC = {
  type: "system",
  fields: { name: "text", generation: "number", handheld: "boolean", created_at: "time" },
  filters: {
    name: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    generation: ["equals", "not_equals", "greater_than", "less_than"],
    handheld: ["equals"],
    created_at: ["since", "before"],
  },
};

type StubFilter = { key: string; field: string; operator: string; operand: string };

// A small stand-in for the backend's filter matching, enough to drive the
// server-side search in these specs.
function applyFilters(list: StubSystem[], filters: StubFilter[]): StubSystem[] {
  return (filters ?? []).reduce<StubSystem[]>((out, f) => {
    return out.filter((s) => {
      const raw =
        f.field === "name"
          ? s.name
          : f.field === "generation"
            ? String(s.generation)
            : f.field === "handheld"
              ? String(s.handheld)
              : (s.customFieldValues.find((v) => v.customFieldName === f.field)
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

const SYSTEMS: StubSystem[] = [
  {
    id: 1,
    key: "system",
    name: "NES",
    generation: 3,
    handheld: false,
    customFieldValues: [
      { customFieldId: 10, customFieldName: "Modded", customFieldType: "boolean", value: "true" },
      { customFieldId: 11, customFieldName: "Controllers", customFieldType: "number", value: "2" },
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
      { customFieldId: 10, customFieldName: "Modded", customFieldType: "boolean", value: "false" },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

// Stubs the system + custom-field proxies so the screen runs end-to-end without
// a live backend.
async function stubSystems(page: Page) {
  const json = (route: Parameters<Parameters<Page["route"]>[1]>[0], body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  // The list loads and searches through the POST search endpoint; branch it so a
  // search applies its filters and any other call returns the full list.
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

// The mass-edit/mass-input modes change how the grid and create dialog render,
// and they're loaded server-side in the layout — so page.route can't stub them.
// These specs all assume the normal (non-mass) UI, so pin both off (the same
// values every other spec pins, to avoid clashing writes to the shared backend
// state); the mass-mode behaviors are covered deterministically by the
// SystemsManager and SystemCreateModal unit tests. Other settings are read back
// and preserved.
async function pinNormalMode(page: Page) {
  const current = await (await page.request.get("/api/ui-settings")).json();
  await page.request.post("/api/ui-settings", {
    data: { ...current, massInputMode: false, massEditMode: false },
  });
}

test.beforeEach(async ({ page }) => {
  await pinNormalMode(page);
  await stubSystems(page);
});

test("is reachable from the sidebar and lists the systems", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Systems" }).click();

  await expect(page).toHaveURL("/systems");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("SYSTEMS");
  await expect(page.getByRole("heading", { level: 2, name: "2 Systems" })).toBeVisible();

  await expect(page.getByText("NES", { exact: true })).toBeVisible();
  await expect(page.getByText("Game Boy", { exact: true })).toBeVisible();
});

test("shows Name + Generation + Handheld + custom-field columns in order", async ({
  page,
}) => {
  await page.goto("/systems");

  await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Generation" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Handheld" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Modded" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Controllers" })).toBeVisible();
});

test("renders the generation as a number and handheld as Yes/No markers", async ({
  page,
}) => {
  await page.goto("/systems");

  await expect(page.getByText("3", { exact: true })).toBeVisible();
  await expect(page.getByText("4", { exact: true })).toBeVisible();

  // Game Boy's row shows handheld Yes; NES's shows No (each row also carries a
  // Modded badge, so assert within the row rather than globally).
  const gameBoyRow = page.getByRole("row").filter({ hasText: "Game Boy" });
  await expect(gameBoyRow.getByRole("img", { name: "Yes" })).toBeVisible();
  const nesRow = page.getByRole("row").filter({ hasText: "NES" });
  await expect(nesRow.getByRole("img", { name: "Yes" })).toBeVisible(); // Modded
  await expect(nesRow.getByRole("img", { name: "No" })).toBeVisible(); // Handheld
});

test("filters the rows via the search box on Enter", async ({ page }) => {
  await page.goto("/systems");
  await expect(page.getByText("NES", { exact: true })).toBeVisible();

  const box = page.getByRole("searchbox", { name: "Search systems" });
  await box.fill("game");
  await box.press("Enter");

  // The text becomes a name-contains chip and the box clears.
  await expect(page.getByRole("button", { name: "Edit Name filter" })).toBeVisible();
  await expect(box).toHaveValue("");

  await expect(page.getByText("Game Boy", { exact: true })).toBeVisible();
  await expect(page.getByText("NES", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "1 System" })).toBeVisible();
});

test("exposes the New, Filter, and per-row delete controls", async ({ page }) => {
  await page.goto("/systems");

  await expect(page.getByRole("button", { name: "New" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add filter" })).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: "NES" });
  await row.hover();
  await expect(row.getByRole("button", { name: "Delete NES" })).toBeVisible();
});

test("creates a system through the New dialog and shows it in the list", async ({
  page,
}) => {
  // Branch the systems proxy by url + method: a create POST (/api/systems)
  // echoes back a saved system with a fresh id; a search POST
  // (/api/systems/search) lists the originals; GET still lists the originals.
  // Registered here so it overrides the beforeEach stub.
  await page.route("**/api/systems**", (route) => {
    const req = route.request();
    if (req.method() === "POST" && !req.url().includes("/search")) {
      const input = req.postDataJSON() as {
        name: string;
        generation: number;
        handheld: boolean;
      };
      const created: StubSystem = {
        id: 3,
        key: "system",
        name: input.name,
        generation: input.generation,
        handheld: input.handheld,
        customFieldValues: [],
        createdAt: "",
        updatedAt: "",
        deletedAt: null,
      };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok", data: created }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok", data: SYSTEMS }),
    });
  });

  await page.goto("/systems");
  await page.getByRole("button", { name: "New" }).click();

  const dialog = page.getByRole("dialog", { name: "Create System" });
  await expect(dialog).toBeVisible();

  // Create stays disabled until both Name and Generation are entered
  // (generation is a required integer; handheld just defaults to No).
  await expect(dialog.getByRole("button", { name: "Create" })).toBeDisabled();

  // The standard fields reuse the detail page's click-to-edit editors.
  await dialog.getByRole("button", { name: "Edit Name" }).click();
  await dialog.getByRole("textbox", { name: "Name" }).fill("Switch");
  await dialog.getByRole("textbox", { name: "Name" }).press("Enter");

  // Name alone isn't enough.
  await expect(dialog.getByRole("button", { name: "Create" })).toBeDisabled();

  await dialog.getByRole("button", { name: "Edit Generation" }).click();
  await dialog.getByRole("spinbutton", { name: "Generation" }).fill("9");
  await dialog.getByRole("spinbutton", { name: "Generation" }).press("Enter");

  await expect(dialog.getByRole("button", { name: "Create" })).toBeEnabled();

  // Handheld is a click-to-toggle Yes/No badge, defaulting to No.
  await dialog.getByRole("button", { name: "Handheld: No" }).click();
  await expect(dialog.getByRole("button", { name: "Handheld: Yes" })).toBeVisible();

  await dialog.getByRole("button", { name: "Create" }).click();

  // Dialog closes and the new system appears at the top of the list.
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Switch", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "3 Systems" }),
  ).toBeVisible();
});

test("the New dialog is keyboard-navigable", async ({ page }) => {
  await page.goto("/systems");

  // Open it from the keyboard; focus should move into the dialog.
  await page.getByRole("button", { name: "New" }).focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Create System" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();

  // Tab is trapped inside the dialog: Shift+Tab off the first control wraps to
  // the last one (Cancel, since Create is disabled while the form is empty).
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

  // Escape closes the dialog and returns focus to the New button that opened it.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "New" })).toBeFocused();
});

test("auto-opens text fields on focus and selects their value to overwrite", async ({
  page,
}) => {
  await page.goto("/systems");
  await page.getByRole("button", { name: "New" }).click();
  const dialog = page.getByRole("dialog", { name: "Create System" });

  // Tab off the Close button onto Name: it opens as a focused textbox, ready to
  // type into — no Enter/click first.
  await page.keyboard.press("Tab");
  const nameInput = dialog.getByRole("textbox", { name: "Name" });
  await expect(nameInput).toBeFocused();
  await page.keyboard.type("First");

  // Tab commits Name and opens the Generation number input the same way.
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("spinbutton", { name: "Generation" })).toBeFocused();

  // Returning to Name re-opens it with its value selected, so typing overwrites
  // rather than appends.
  await page.keyboard.press("Shift+Tab");
  await expect(nameInput).toBeFocused();
  await page.keyboard.type("Second");
  await expect(nameInput).toHaveValue("Second");
});

test("closes the New dialog without creating on Cancel", async ({ page }) => {
  await page.goto("/systems");
  await page.getByRole("button", { name: "New" }).click();

  const dialog = page.getByRole("dialog", { name: "Create System" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("heading", { level: 2, name: "2 Systems" }),
  ).toBeVisible();
});

// The detail page fetches its system server-side (Playwright's page.route can't
// stub that), so this smoke test runs against the live dev backend's system #1;
// the deterministic edit-logic coverage lives in __tests__/SystemDetail.test.tsx.
test("the system detail page shows the Fields card and links back to the list", async ({
  page,
}) => {
  await page.goto("/systems/1");

  // The Fields card with the fixed Name + Generation + Handheld rows is the
  // heart of the screen.
  await expect(page.getByText("Fields", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Name" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Generation" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Handheld: (Yes|No)$/ })).toBeVisible();

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL("/systems");
  await expect(page.getByRole("heading", { level: 2, name: "2 Systems" })).toBeVisible();
});
