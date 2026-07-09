import { test, expect, type Page, type Route } from "@playwright/test";
import { AUTH_STATE } from "./authState";
import { DEFAULT_STANDARD_FIELDS } from "../src/lib/uiSettings.types";

// Phase 3 remaining slices (localFiles/adaptive_rollout.md): at a phone
// viewport the toys, systems, board games, and board game boxes lists render
// as tappable read-only cards instead of the data table. Card slots follow
// the settled design: standard fields on the face, first boolean (or the
// entity's designated standard boolean) as the corner badge, progress bars,
// and a single clipped pill row. Tap-through to a real detail page and
// delete-from-detail are covered by mobile-video-games.spec.ts and
// mobile-touch-parity.spec.ts; box-style create dialogs are covered by the
// video game shelf twin — here the simpler toy/system create modals prove the
// create-appears-as-card loop for this slice.
//
// Create flows are writes, so the file runs with the authenticated session.
test.use({ storageState: AUTH_STATE });

const json = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

// Every screen loads these; the specs here never filter or sort.
function filterSpec(type: string) {
  return {
    type: `${type}_filters`,
    fields: { name: "text", all_fields: "sort", pagination_fields: "pagination" },
    filters: {
      name: ["equals", "not_equals", "contains", "starts_with", "ends_with"],
      all_fields: ["order_by", "order_by_desc"],
      pagination_fields: ["limit", "offset"],
    },
  };
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
    json(route, { status: "ok", data: filterSpec(entity) }),
  );
}

// ui_settings are loaded server-side (page.route can't stub them), so pin the
// modes these specs assume — the same values every other spec pins, per the
// CLAUDE.md shared-backend-state rule.
async function pinNormalMode(page: Page) {
  const current = await (await page.request.get("/api/ui-settings")).json();
  await page.request.post("/api/ui-settings", {
    data: {
      ...current,
      massInputMode: false,
      massEditMode: false,
      boardGamesDefaultView: "list",
      standardFields: DEFAULT_STANDARD_FIELDS,
    },
  });
}

test.describe("toy cards @mobile", () => {
  const FIELDS = [
    { id: 10, name: "Boxed", type: "boolean", entityKey: "toy", order: 0, options: [] },
    {
      id: 11,
      name: "Build",
      type: "progress_bar",
      entityKey: "toy",
      order: 1,
      options: [
        { id: 21, customFieldId: 11, name: "Purchased", isDefault: true, order: 0 },
        { id: 22, customFieldId: 11, name: "Opened", isDefault: false, order: 1 },
        { id: 23, customFieldId: 11, name: "Painted", isDefault: false, order: 2 },
      ],
    },
  ];
  const TOYS = [
    {
      id: 1,
      key: "toy",
      name: "R2-D2",
      set: "Star Wars",
      customFieldValues: [
        { customFieldId: 10, customFieldName: "Boxed", customFieldType: "boolean", value: "true", valueOptionId: null },
        { customFieldId: 11, customFieldName: "Build", customFieldType: "progress_bar", value: "Opened", valueOptionId: 22 },
      ],
      createdAt: "",
      updatedAt: "",
      deletedAt: null,
    },
  ];

  test.beforeEach(async ({ page }) => {
    await pinNormalMode(page);
    await stubCommon(page, "toy");
    await page.route("**/api/custom-fields/entity/toy", (route) =>
      json(route, { status: "ok", data: FIELDS }),
    );
    await page.route("**/api/toys**", (route) => {
      const req = route.request();
      if (req.method() === "POST" && !req.url().includes("/search")) {
        const input = req.postDataJSON() as { name: string; set: string };
        return json(route, {
          status: "ok",
          data: {
            id: 99,
            key: "toy",
            name: input.name,
            set: input.set,
            customFieldValues: [],
            createdAt: "",
            updatedAt: "",
            deletedAt: null,
          },
        });
      }
      return json(route, { status: "ok", data: TOYS });
    });
  });

  test("renders cards and creating a toy adds one", async ({ page }) => {
    await page.goto("/toys");

    const card = page.locator("li").filter({
      has: page.getByRole("link", { name: "R2-D2" }),
    });
    await expect(card.getByText("Star Wars")).toBeVisible();
    await expect(card.getByRole("img", { name: "Boxed: Yes" })).toBeVisible();
    await expect(
      card.getByRole("img", { name: "Build: Opened (2 of 3)" }),
    ).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);

    await page.getByRole("button", { name: "New" }).tap();
    const dialog = page.getByRole("dialog", { name: "Create Toy" });
    await dialog.getByRole("textbox", { name: "Name" }).fill("Buzz Lightyear");
    await dialog.getByRole("textbox", { name: "Name" }).press("Enter");
    await dialog.getByRole("button", { name: "Create" }).click();

    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("link", { name: "Buzz Lightyear" }),
    ).toBeVisible();
  });
});

test.describe("system cards @mobile", () => {
  const SYSTEMS = [
    {
      id: 1,
      key: "system",
      name: "NES",
      generation: 3,
      handheld: false,
      customFieldValues: [
        { customFieldId: 10, customFieldName: "Modded", customFieldType: "boolean", value: "true", valueOptionId: null },
      ],
      createdAt: "",
      updatedAt: "",
      deletedAt: null,
    },
  ];

  test.beforeEach(async ({ page }) => {
    await pinNormalMode(page);
    await stubCommon(page, "system");
    await page.route("**/api/custom-fields/entity/system", (route) =>
      json(route, {
        status: "ok",
        data: [
          { id: 10, name: "Modded", type: "boolean", entityKey: "system", order: 0, options: [] },
        ],
      }),
    );
    await page.route("**/api/systems**", (route) => {
      const req = route.request();
      if (req.method() === "POST" && !req.url().includes("/search")) {
        const input = req.postDataJSON() as {
          name: string;
          generation: number;
          handheld: boolean;
        };
        return json(route, {
          status: "ok",
          data: {
            id: 99,
            key: "system",
            name: input.name,
            generation: input.generation,
            handheld: input.handheld,
            customFieldValues: [],
            createdAt: "",
            updatedAt: "",
            deletedAt: null,
          },
        });
      }
      return json(route, { status: "ok", data: SYSTEMS });
    });
  });

  test("renders cards with Handheld as the corner badge and creating adds one", async ({
    page,
  }) => {
    await page.goto("/systems");

    const card = page.locator("li").filter({
      has: page.getByRole("link", { name: "NES" }),
    });
    await expect(card.getByText("Generation 3")).toBeVisible();
    // Handheld (standard) owns the corner; Modded (custom boolean) is a pill.
    await expect(card.getByRole("img", { name: "Handheld: No" })).toBeVisible();
    await expect(card.getByRole("img", { name: "Modded: Yes" })).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);

    await page.getByRole("button", { name: "New" }).tap();
    const dialog = page.getByRole("dialog", { name: "Create System" });
    await dialog.getByRole("textbox", { name: "Name" }).fill("Switch");
    await dialog.getByRole("textbox", { name: "Name" }).press("Enter");
    await dialog.getByRole("button", { name: "Edit Generation" }).click();
    await dialog.getByRole("spinbutton", { name: "Generation" }).fill("9");
    await dialog.getByRole("spinbutton", { name: "Generation" }).press("Enter");
    await dialog.getByRole("button", { name: "Create" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: "Switch" })).toBeVisible();
  });
});

test.describe("board game cards @mobile", () => {
  const GAMES = [
    {
      id: 1,
      key: "boardGame",
      title: "Set-A-Watch",
      boardGameBoxes: [
        { id: 31, title: "Set-A-Watch", isExpansion: false, isStandAlone: true, baseSetId: null, customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
        { id: 32, title: "Doomed Run", isExpansion: true, isStandAlone: false, baseSetId: 31, customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
      ],
      customFieldValues: [
        { customFieldId: 10, customFieldName: "Has App", customFieldType: "boolean", value: "true", valueOptionId: null },
      ],
      createdAt: "",
      updatedAt: "",
      deletedAt: null,
    },
  ];
  const BOXES = [
    {
      id: 31,
      key: "boardGameBox",
      title: "Set-A-Watch Base Box",
      isExpansion: false,
      isStandAlone: true,
      baseSetId: null,
      boardGame: { id: 41, title: "Set-A-Watch", customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
      customFieldValues: [],
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
      boardGame: { id: 41, title: "Set-A-Watch", customFieldValues: [], createdAt: "", updatedAt: "", deletedAt: null },
      customFieldValues: [],
      createdAt: "",
      updatedAt: "",
      deletedAt: null,
    },
  ];

  test.beforeEach(async ({ page }) => {
    await pinNormalMode(page);
    await stubCommon(page, "boardGame");
    await page.route("**/api/filters/boardGameBox", (route) =>
      json(route, { status: "ok", data: filterSpec("boardGameBox") }),
    );
    await page.route("**/api/custom-fields/entity/boardGame", (route) =>
      json(route, {
        status: "ok",
        data: [
          { id: 10, name: "Has App", type: "boolean", entityKey: "boardGame", order: 0, options: [] },
        ],
      }),
    );
    await page.route("**/api/custom-fields/entity/boardGameBox", (route) =>
      json(route, { status: "ok", data: [] }),
    );
    await page.route("**/api/board-games**", (route) =>
      json(route, { status: "ok", data: GAMES }),
    );
    await page.route("**/api/board-game-boxes**", (route) =>
      json(route, { status: "ok", data: BOXES }),
    );
  });

  test("the list renders game cards with the box count subtitle", async ({
    page,
  }) => {
    await page.goto("/board-games");

    const card = page.locator("li").filter({
      has: page.getByRole("link", { name: "Set-A-Watch" }),
    });
    await expect(card.getByText("2 boxes")).toBeVisible();
    await expect(card.getByRole("img", { name: "Has App: Yes" })).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
  });

  test("the shelf renders box cards with Expansion as the corner badge", async ({
    page,
  }) => {
    await page.goto("/board-games?view=shelf");

    const expansion = page.locator("li").filter({
      has: page.getByRole("link", { name: "Set-A-Watch Doomed Run" }),
    });
    await expect(
      expansion.getByText("Set-A-Watch · Base: Set-A-Watch Base Box"),
    ).toBeVisible();
    await expect(
      expansion.getByRole("img", { name: "Expansion: Yes" }),
    ).toBeVisible();
    await expect(
      expansion.getByRole("img", { name: "Stand Alone: No" }),
    ).toBeVisible();

    const base = page.locator("li").filter({
      has: page.getByRole("link", { name: "Set-A-Watch Base Box" }),
    });
    await expect(base.getByRole("img", { name: "Expansion: No" })).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
  });
});
