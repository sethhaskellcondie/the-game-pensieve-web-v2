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

const FIELDS: StubField[] = [
  { id: 10, name: "Boxed", type: "boolean", entityKey: "toy", order: 0, options: [] },
  { id: 11, name: "Year", type: "number", entityKey: "toy", order: 1, options: [] },
];

const FILTER_SPEC = {
  type: "toy",
  fields: { name: "text", set: "text", created_at: "time" },
  filters: {
    name: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    set: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
    created_at: ["since", "before"],
  },
};

type StubFilter = { key: string; field: string; operator: string; operand: string };

// A small stand-in for the backend's filter matching, enough to drive the
// server-side search in these specs.
function applyFilters(list: StubToy[], filters: StubFilter[]): StubToy[] {
  return (filters ?? []).reduce<StubToy[]>((out, f) => {
    return out.filter((t) => {
      const raw =
        f.field === "name"
          ? t.name
          : f.field === "set"
            ? t.set
            : (t.customFieldValues.find((v) => v.customFieldName === f.field)
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

const TOYS: StubToy[] = [
  {
    id: 1,
    key: "toy",
    name: "R2-D2",
    set: "Star Wars",
    customFieldValues: [
      { customFieldId: 10, customFieldName: "Boxed", customFieldType: "boolean", value: "true", valueOptionId: null },
      { customFieldId: 11, customFieldName: "Year", customFieldType: "number", value: "1977", valueOptionId: null },
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
      { customFieldId: 10, customFieldName: "Boxed", customFieldType: "boolean", value: "false", valueOptionId: null },
    ],
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  },
];

// Stubs the toy + custom-field proxies so the screen runs end-to-end without a
// live backend.
async function stubToys(page: Page) {
  const json = (route: Parameters<Parameters<Page["route"]>[1]>[0], body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  // The list loads and searches through the POST search endpoint; branch it so a
  // search applies its filters and any other call returns the full list.
  await page.route("**/api/toys**", (route) => {
    const req = route.request();
    if (req.url().includes("/search") && req.method() === "POST") {
      const { filters } = req.postDataJSON() as { filters: StubFilter[] };
      return json(route, { status: "ok", data: applyFilters(TOYS, filters) });
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

// The mass-edit/mass-input modes change how the grid and create dialog render,
// and they're loaded server-side in the layout — so page.route can't stub them.
// These specs all assume the normal (non-mass) UI, so pin both off (the default);
// the mass-mode behaviors are covered deterministically by the ToysManager and
// ToyCreateModal unit tests. The standard-field columns are pinned to all-shown
// (the default) because these specs assert on them. Other settings are read
// back and preserved.
async function pinNormalMode(page: Page) {
  const current = await (await page.request.get("/api/ui-settings")).json();
  await page.request.post("/api/ui-settings", {
    data: {
      ...current,
      massInputMode: false,
      massEditMode: false,
      standardFields: DEFAULT_STANDARD_FIELDS,
    },
  });
}

test.beforeEach(async ({ page }) => {
  await pinNormalMode(page);
  await stubToys(page);
});

test("is reachable from the sidebar and lists the toys", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Toys" }).click();

  await expect(page).toHaveURL("/toys");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("TOYS");
  await expect(page.getByRole("heading", { level: 2, name: "2 Toys" })).toBeVisible();

  await expect(page.getByText("R2-D2", { exact: true })).toBeVisible();
  await expect(page.getByText("Pikachu", { exact: true })).toBeVisible();
});

test("shows Name + Set + custom-field columns in order", async ({ page }) => {
  await page.goto("/toys");

  await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Set" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Boxed" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Year" })).toBeVisible();
});

test("renders boolean values as Yes/No markers", async ({ page }) => {
  await page.goto("/toys");

  await expect(page.getByRole("img", { name: "Yes" })).toBeVisible();
  await expect(page.getByRole("img", { name: "No" })).toBeVisible();
});

test("filters the rows via the search box on Enter", async ({ page }) => {
  await page.goto("/toys");
  await expect(page.getByText("R2-D2", { exact: true })).toBeVisible();

  const box = page.getByRole("searchbox", { name: "Search toys" });
  await box.fill("pika");
  await box.press("Enter");

  // The text becomes a name-contains chip and the box clears.
  await expect(page.getByRole("button", { name: "Edit Name filter" })).toBeVisible();
  await expect(box).toHaveValue("");

  await expect(page.getByText("Pikachu", { exact: true })).toBeVisible();
  await expect(page.getByText("R2-D2", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "1 Toy" })).toBeVisible();
});

test("exposes the New and Filter controls, with no per-row delete", async ({
  page,
}) => {
  await page.goto("/toys");

  await expect(page.getByRole("button", { name: "New" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add filter" })).toBeVisible();

  // Delete moved off the grid row and onto the toy detail page (covered by the
  // DeleteEntityButton unit test, since the detail page fetches server-side and
  // can't be stubbed through page.route).
  const row = page.getByRole("row").filter({ hasText: "R2-D2" });
  await row.hover();
  await expect(row.getByRole("button", { name: "Delete R2-D2" })).toHaveCount(0);
});

test("creates a toy through the New dialog and shows it in the list", async ({
  page,
}) => {
  // Branch the toys proxy by url + method: a create POST (/api/toys) echoes back
  // a saved toy with a fresh id; a search POST (/api/toys/search) lists the
  // originals; GET still lists the originals. Registered here so it overrides the
  // beforeEach stub.
  await page.route("**/api/toys**", (route) => {
    const req = route.request();
    if (req.method() === "POST" && !req.url().includes("/search")) {
      const input = req.postDataJSON() as {
        name: string;
        set: string;
      };
      const created: StubToy = {
        id: 3,
        key: "toy",
        name: input.name,
        set: input.set,
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
      body: JSON.stringify({ status: "ok", data: TOYS }),
    });
  });

  await page.goto("/toys");
  await page.getByRole("button", { name: "New" }).click();

  const dialog = page.getByRole("dialog", { name: "Create Toy" });
  await expect(dialog).toBeVisible();

  // Create is disabled until a Name is entered.
  await expect(dialog.getByRole("button", { name: "Create" })).toBeDisabled();

  // Name and Set reuse the detail page's click-to-edit editors.
  await dialog.getByRole("button", { name: "Edit Name" }).click();
  await dialog.getByRole("textbox", { name: "Name" }).fill("Buzz Lightyear");
  await dialog.getByRole("textbox", { name: "Name" }).press("Enter");

  await dialog.getByRole("button", { name: "Edit Set" }).click();
  await dialog.getByRole("textbox", { name: "Set" }).fill("Toy Story");
  await dialog.getByRole("textbox", { name: "Set" }).press("Enter");

  await dialog.getByRole("button", { name: "Create" }).click();

  // Dialog closes and the new toy appears at the top of the list.
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Buzz Lightyear", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "3 Toys" }),
  ).toBeVisible();
});

test("the New dialog is keyboard-navigable", async ({ page }) => {
  await page.goto("/toys");

  // Open it from the keyboard; focus should move into the dialog.
  await page.getByRole("button", { name: "New" }).focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Create Toy" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();

  // Tab is trapped inside the dialog: Shift+Tab off the first control wraps to
  // the last one (Cancel, since Create is disabled while Name is empty).
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
  await page.goto("/toys");
  await page.getByRole("button", { name: "New" }).click();
  const dialog = page.getByRole("dialog", { name: "Create Toy" });

  // Tab off the Close button onto Name: it opens as a focused textbox, ready to
  // type into — no Enter/click first.
  await page.keyboard.press("Tab");
  const nameInput = dialog.getByRole("textbox", { name: "Name" });
  await expect(nameInput).toBeFocused();
  await page.keyboard.type("First");

  // Tab commits Name and opens Set the same way.
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("textbox", { name: "Set" })).toBeFocused();

  // Returning to Name re-opens it with its value selected, so typing overwrites
  // rather than appends.
  await page.keyboard.press("Shift+Tab");
  await expect(nameInput).toBeFocused();
  await page.keyboard.type("Second");
  await expect(nameInput).toHaveValue("Second");
});

test("auto-opens a dropdown field's menu on focus", async ({ page }) => {
  // Swap in a single dropdown custom field so the dialog renders one.
  await page.route("**/api/custom-fields/entity/toy", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        data: [
          {
            id: 20,
            name: "Condition",
            type: "dropdown",
            entityKey: "toy",
            order: 0,
            options: [
              { id: 1, customFieldId: 20, name: "Mint", isDefault: true, order: 0 },
              { id: 2, customFieldId: 20, name: "Used", isDefault: false, order: 1 },
            ],
          },
        ],
      }),
    }),
  );

  await page.goto("/toys");
  await page.getByRole("button", { name: "New" }).click();
  const dialog = page.getByRole("dialog", { name: "Create Toy" });

  // Focusing the dropdown trigger opens its listbox — no click/Enter needed.
  await dialog.getByRole("button", { name: "Condition" }).focus();
  await expect(
    dialog.getByRole("listbox", { name: "Condition" }),
  ).toBeVisible();
});

test("radio/progress options wrap within the create dialog", async ({ page }) => {
  await page.route("**/api/custom-fields/entity/toy", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        data: [
          {
            id: 30,
            name: "Condition",
            type: "radio_button",
            entityKey: "toy",
            order: 0,
            options: [
              { id: 1, customFieldId: 30, name: "Brand New In Box", isDefault: true, order: 0 },
              { id: 2, customFieldId: 30, name: "Lightly Played", isDefault: false, order: 1 },
              { id: 3, customFieldId: 30, name: "Moderately Worn", isDefault: false, order: 2 },
              { id: 4, customFieldId: 30, name: "Heavily Damaged", isDefault: false, order: 3 },
              { id: 5, customFieldId: 30, name: "For Parts Only", isDefault: false, order: 4 },
            ],
          },
        ],
      }),
    }),
  );

  await page.goto("/toys");
  await page.getByRole("button", { name: "New" }).click();
  const dialog = page.getByRole("dialog", { name: "Create Toy" });

  // The option chips are allowed to wrap onto multiple lines in the card rather
  // than clipping at its edge.
  const group = dialog.getByRole("radiogroup", { name: "Condition" });
  await expect(group).toBeVisible();
  const flexWrap = await group.evaluate(
    (el) => getComputedStyle(el).flexWrap,
  );
  expect(flexWrap).toBe("wrap");
});

test("closes the New dialog without creating on Cancel", async ({ page }) => {
  await page.goto("/toys");
  await page.getByRole("button", { name: "New" }).click();

  const dialog = page.getByRole("dialog", { name: "Create Toy" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("heading", { level: 2, name: "2 Toys" }),
  ).toBeVisible();
});

// The detail page fetches its toy server-side (Playwright's page.route can't
// stub that), so this smoke test runs against the live dev backend's toy #1;
// the deterministic edit-logic coverage lives in __tests__/ToyDetail.test.tsx.
test("the toy detail page shows the Fields card and links back to the list", async ({
  page,
}) => {
  await page.goto("/toys/1");

  // The Fields card with the fixed Name + Set rows is the heart of the screen.
  await expect(page.getByText("Fields", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Name" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Set" })).toBeVisible();

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL("/toys");
  await expect(page.getByRole("heading", { level: 2, name: "2 Toys" })).toBeVisible();
});
