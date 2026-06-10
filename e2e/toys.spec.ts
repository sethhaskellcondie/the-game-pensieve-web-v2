import { test, expect, type Page } from "@playwright/test";

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
  }[];
  createdAt: string;
  updatedAt: string;
  deletedAt: null;
};

const FIELDS: StubField[] = [
  { id: 10, name: "Boxed", type: "boolean", entityKey: "toy", order: 0, options: [] },
  { id: 11, name: "Year", type: "number", entityKey: "toy", order: 1, options: [] },
];

const TOYS: StubToy[] = [
  {
    id: 1,
    key: "toy",
    name: "R2-D2",
    set: "Star Wars",
    customFieldValues: [
      { customFieldId: 10, customFieldName: "Boxed", customFieldType: "boolean", value: "true" },
      { customFieldId: 11, customFieldName: "Year", customFieldType: "number", value: "1977" },
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
      { customFieldId: 10, customFieldName: "Boxed", customFieldType: "boolean", value: "false" },
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

  await page.route("**/api/toys**", (route) =>
    json(route, { status: "ok", data: TOYS }),
  );
  await page.route("**/api/custom-fields/entity/toy", (route) =>
    json(route, { status: "ok", data: FIELDS }),
  );
}

test.beforeEach(async ({ page }) => {
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

test("filters the rows via the search box", async ({ page }) => {
  await page.goto("/toys");
  await expect(page.getByText("R2-D2", { exact: true })).toBeVisible();

  await page.getByRole("searchbox", { name: "Search toys" }).fill("pika");

  await expect(page.getByText("Pikachu", { exact: true })).toBeVisible();
  await expect(page.getByText("R2-D2", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "1 Toy" })).toBeVisible();
});

test("exposes the New, Filter, and per-row delete controls", async ({ page }) => {
  await page.goto("/toys");

  await expect(page.getByRole("button", { name: "New" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Filter" })).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: "R2-D2" });
  await row.hover();
  await expect(row.getByRole("button", { name: "Delete R2-D2" })).toBeVisible();
});
