import { test, expect, type Page } from "@playwright/test";
import { AUTH_STATE } from "./authState";
import { skipUnlessSecured } from "./securedOnly";

// /options requires a logged-in account (guests are redirected to /login), so
// this whole file runs with the shared authenticated session from auth.setup.ts.
test.use({ storageState: AUTH_STATE });

// The Default Sort Options section fires a fan-out of fetches on mount (the
// stored defaults plus a filter spec and custom-field list per entity). Stub
// them all so these specs stay fast and hermetic — none of the tests here
// exercise that section, and the real requests slow the dev server enough
// under a parallel run to flake the click-then-assert tests.
test.beforeEach(async ({ page }) => {
  const json = (
    route: Parameters<Parameters<Page["route"]>[1]>[0],
    body: unknown,
  ) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
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
});

test("options page is reachable from the sidebar", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Options" }).click();

  await expect(page).toHaveURL("/options");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("OPTIONS");
});

test("UI Settings toggles flip and persist when clicked", async ({ page }) => {
  // Stub the write proxy so the click persists through it without mutating the
  // shared backend (otherwise the toggle's initial state leaks between runs).
  await page.route("**/api/ui-settings", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    }),
  );

  await page.goto("/options");

  // Beginner Mode is a plain boolean switch visible to every account (Developer
  // Mode is admin-only), so it's the stand-in for exercising the toggle machinery.
  const beginnerMode = page.getByRole("switch", { name: "Beginner Mode" });
  // The initial state is loaded from the backend server-side, so assert the
  // toggle flips relative to whatever it currently is rather than a fixed value.
  const before = await beginnerMode.getAttribute("aria-checked");
  const expected = before === "true" ? "false" : "true";

  // Flipping the toggle should optimistically update the UI and POST the new
  // settings to the write proxy.
  const persisted = page.waitForRequest(
    (req) => req.url().includes("/api/ui-settings") && req.method() === "POST",
  );
  await beginnerMode.click();
  await expect(beginnerMode).toHaveAttribute("aria-checked", expected);
  await persisted;
});

test("Default Video Games View segments flip and persist when clicked", async ({
  page,
}) => {
  // Same approach as the toggles: stub the write proxy so the click persists
  // through it without mutating the shared backend state.
  await page.route("**/api/ui-settings", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    }),
  );

  await page.goto("/options");

  const group = page.getByRole("radiogroup", {
    name: "Default Video Games View",
  });
  const list = group.getByRole("radio", { name: "List" });
  const shelf = group.getByRole("radio", { name: "Shelf" });

  // Exactly one segment is selected; pick the other one and assert the
  // selection moves once the (stubbed) write confirms.
  const shelfSelected =
    (await shelf.getAttribute("aria-checked")) === "true";
  const target = shelfSelected ? list : shelf;
  const other = shelfSelected ? shelf : list;

  const persisted = page.waitForRequest(
    (req) => req.url().includes("/api/ui-settings") && req.method() === "POST",
  );
  await target.click();
  await expect(target).toHaveAttribute("aria-checked", "true");
  await expect(other).toHaveAttribute("aria-checked", "false");
  await persisted;
});

test("Set Fields dialog stages standard-field changes and saves them", async ({
  page,
}) => {
  // Stub the write proxy so saving persists through it without mutating the
  // shared backend state.
  await page.route("**/api/ui-settings", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    }),
  );

  await page.goto("/options");

  await page.getByRole("button", { name: "Set Fields" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Show/Hide Standard Fields",
  });
  await expect(dialog).toBeVisible();

  // The dialog state is loaded from the backend server-side, so flip relative
  // to whatever the field currently is rather than a fixed value. The Yes/No
  // pill's accessible name includes its value, so match on the field prefix.
  const toySet = dialog.getByRole("button", { name: /^Toys: Set:/ });
  const before = await toySet.getAttribute("aria-pressed");
  const flipped = before === "true" ? "false" : "true";

  // Flipping only stages the change; nothing is written until Save Fields.
  await toySet.click();
  await expect(toySet).toHaveAttribute("aria-pressed", flipped);

  const persisted = page.waitForRequest(
    (req) => req.url().includes("/api/ui-settings") && req.method() === "POST",
  );
  await dialog.getByRole("button", { name: "Save Fields" }).click();
  const request = await persisted;
  expect(request.postDataJSON().standardFields.toy.set).toBe(
    flipped === "true",
  );
  await expect(dialog).not.toBeVisible();
});

test("toggle does not change when the persist request fails", async ({
  page,
}) => {
  // Writes are confirmed: if the backend rejects the change, the UI must stay on
  // the last known-good value rather than diverging from it.
  await page.route("**/api/ui-settings", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false }),
    }),
  );

  await page.goto("/options");

  // Beginner Mode stands in for the toggle machinery; it's visible to every
  // account, whereas Developer Mode is gated to admins.
  const beginnerMode = page.getByRole("switch", { name: "Beginner Mode" });
  const before = await beginnerMode.getAttribute("aria-checked");

  // Wait for the rejected write to come back before asserting nothing changed.
  const response = page.waitForResponse("**/api/ui-settings");
  await beginnerMode.click();
  await response;

  await expect(beginnerMode).toHaveAttribute("aria-checked", before ?? "false");
});

test("Hide Animations toggle parks the header on a static frame", async ({
  page,
}) => {
  await page.route("**/api/ui-settings", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    }),
  );

  await page.goto("/options");

  const hideAnimations = page.getByRole("switch", { name: "Hide Animations" });
  const header = page.getByRole("banner");

  // Make sure it starts off, so the header is animated.
  if ((await hideAnimations.getAttribute("aria-checked")) === "true") {
    await hideAnimations.click();
    await expect(hideAnimations).toHaveAttribute("aria-checked", "false");
  }
  await expect(header).toHaveAttribute("data-static", "false");

  // Turning it on parks the header background on a static frame.
  await hideAnimations.click();
  await expect(hideAnimations).toHaveAttribute("aria-checked", "true");
  await expect(header).toHaveAttribute("data-static", "true");
});

// Developer Mode (and the API Tools it unlocks) became an admin-only affordance,
// and the suite's shared account is a trial user. So rather than exercising the
// heartbeat readout — unreachable without an admin session — these specs assert
// the gating itself: the admin-only controls stay hidden for a non-admin, while
// the ordinary settings remain fully available.

test("Developer Mode toggle is hidden for non-admin accounts", async ({
  page,
  request,
}) => {
  // Admin gating only exists on a secured backend; in permit-all mode the
  // anonymous owner sees the toggle (unsecured.spec.ts asserts that inverse).
  await skipUnlessSecured(request);
  await page.goto("/options");

  // The trial account isn't an admin, so the Developer Mode switch is filtered
  // out of UI Settings entirely.
  await expect(
    page.getByRole("switch", { name: "Developer Mode" }),
  ).toHaveCount(0);
});

test("the API Tools section is hidden for non-admin accounts", async ({
  page,
}) => {
  await page.goto("/options");

  // API Tools (the heartbeat check) rides on Developer Mode, so a non-admin
  // never sees the section, its button, or any status readout.
  await expect(
    page.getByRole("heading", { name: "API Tools" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Check Heartbeat" }),
  ).toBeHidden();
  await expect(page.getByText(/SECURED|OFFLINE/)).toHaveCount(0);
});

test("the standard UI Settings toggles stay available to non-admin accounts", async ({
  page,
}) => {
  await page.goto("/options");

  // The gating is surgical: only the admin-only affordance is removed, while the
  // everyday toggles remain visible to a trial user.
  await expect(
    page.getByRole("switch", { name: "Beginner Mode" }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Mass Input Mode" }),
  ).toBeVisible();
});
