import { test, expect, type Page, type Route } from "@playwright/test";
import { AUTH_STATE } from "./authState";
import { DEFAULT_STANDARD_FIELDS } from "../src/lib/uiSettings.types";

// At a phone viewport the anchored
// Sort and Filter popovers become full-screen panels (decided over a bottom
// sheet) — a visible title, stacked controls, and a Done/Cancel affordance
// instead of outside-click dismissal. Same fields, operators, and chips as
// desktop; only the container changes.
test.use({ storageState: AUTH_STATE });

const json = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

type StubFilter = { field: string; operator: string; operand: string };

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

async function stubCommon(page: Page, entity: string) {
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
  await page.route(`**/api/filters/${entity}`, (route) =>
    json(route, {
      status: "ok",
      data: {
        type: `${entity}_filters`,
        fields: {
          name: "text",
          all_fields: "sort",
          pagination_fields: "pagination",
        },
        filters: {
          name: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
          all_fields: ["order_by", "order_by_desc"],
          pagination_fields: ["limit", "offset"],
        },
      },
    }),
  );
  await page.route(`**/api/custom-fields/entity/${entity}`, (route) =>
    json(route, { status: "ok", data: [] }),
  );
}

test.describe("mobile filter panel @mobile", () => {
  const TOYS = [
    { id: 1, key: "toy", name: "R2-D2", set: "Star Wars", customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
    { id: 2, key: "toy", name: "Pikachu", set: "Pokemon", customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
  ];

  test.beforeEach(async ({ page }) => {
    await pinNormalMode(page);
    await stubCommon(page, "toy");
    await page.route("**/api/toys**", (route) => {
      const req = route.request();
      if (req.url().includes("/search") && req.method() === "POST") {
        const { filters } = req.postDataJSON() as { filters: StubFilter[] };
        const rows = (filters ?? [])
          .filter((f) => f.operator === "contains")
          .reduce(
            (out, f) =>
              out.filter((t) =>
                t.name.toLowerCase().includes(f.operand.toLowerCase()),
              ),
            TOYS,
          );
        return json(route, { status: "ok", data: rows });
      }
      return json(route, { status: "ok", data: TOYS });
    });
  });

  test("adds a filter through the full-screen panel and the chip applies", async ({
    page,
  }) => {
    await page.goto("/toys");
    await expect(page.getByRole("link", { name: "Pikachu" })).toBeVisible();

    // The trigger reads "Filter" but its accessible name is always Add filter.
    await page.getByRole("button", { name: "Add filter" }).tap();
    const dialog = page.getByRole("dialog", { name: "Add filter" });
    await expect(dialog).toBeVisible();
    // Full-screen: the panel spans the whole viewport.
    const box = (await dialog.boundingBox())!;
    expect(box.width).toBe(page.viewportSize()!.width);
    expect(box.height).toBe(page.viewportSize()!.height);
    await expect(dialog.getByText("Add filter")).toBeVisible();

    // Same editor as desktop: Name is the default field; pick contains + value.
    await dialog.getByRole("button", { name: "Filter operator" }).tap();
    await page.getByRole("option", { name: "contains" }).tap();
    await dialog.getByRole("textbox", { name: "Name value" }).fill("R2");
    await dialog.getByRole("button", { name: "Add", exact: true }).tap();

    // Panel closes, the chip lands, and the search narrows to the match.
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Edit Name filter" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "R2-D2" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pikachu" })).toHaveCount(0);
  });
});

test.describe("mobile sort panel @mobile", () => {
  const SYSTEMS = [
    { id: 1, key: "system", name: "NES", generation: 3, handheld: false, customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
    { id: 2, key: "system", name: "SNES", generation: 4, handheld: true, customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
  ];

  test.beforeEach(async ({ page }) => {
    await pinNormalMode(page);
    await stubCommon(page, "system");
    await page.route("**/api/systems**", (route) => {
      const req = route.request();
      if (req.url().includes("/search") && req.method() === "POST") {
        const { filters } = req.postDataJSON() as { filters: StubFilter[] };
        const rows = [...SYSTEMS];
        for (const f of filters ?? []) {
          if (f.operator === "order_by" || f.operator === "order_by_desc") {
            rows.sort((a, b) =>
              String(a[f.field as "name"]).localeCompare(
                String(b[f.field as "name"]),
              ),
            );
            if (f.operator === "order_by_desc") rows.reverse();
          }
        }
        return json(route, { status: "ok", data: rows });
      }
      return json(route, { status: "ok", data: SYSTEMS });
    });
  });

  test("builds a sort in the full-screen panel and Done closes it", async ({
    page,
  }) => {
    await page.goto("/systems");
    await expect(
      page.getByRole("link", { name: "NES", exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Sort" }).tap();
    const dialog = page.getByRole("dialog", { name: "Sort options" });
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.width).toBe(page.viewportSize()!.width);
    expect(box.height).toBe(page.viewportSize()!.height);

    // Build "Sort by Name, Desc" — SNES sorts above NES.
    await dialog.getByRole("button", { name: "Add sort" }).tap();
    await dialog.getByRole("radio", { name: "Desc" }).tap();

    await dialog.getByRole("button", { name: "Done" }).tap();
    await expect(dialog).toBeHidden();
    // The Sort button wears the active-level count.
    await expect(page.getByRole("button", { name: "Sort" })).toContainText("1");

    // The card list reflects the sort: SNES first.
    const links = page.getByRole("link", { name: /NES/ });
    await expect(links.first()).toHaveText("SNES");
  });
});
