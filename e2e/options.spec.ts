import { test, expect, type Page } from "@playwright/test";

// The API Tools section is only rendered in developer mode. Stub the settings
// write proxy and flip the toggle on (if it isn't already) so the section is
// reliably present regardless of the backend's stored value.
async function enableDeveloperMode(page: Page) {
  await page.route("**/api/ui-settings", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    }),
  );

  await page.goto("/options");

  const developerMode = page.getByRole("switch", { name: "Developer Mode" });
  if ((await developerMode.getAttribute("aria-checked")) !== "true") {
    await developerMode.click();
    await expect(developerMode).toHaveAttribute("aria-checked", "true");
  }
}

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

  const developerMode = page.getByRole("switch", { name: "Developer Mode" });
  // The initial state is loaded from the backend server-side, so assert the
  // toggle flips relative to whatever it currently is rather than a fixed value.
  const before = await developerMode.getAttribute("aria-checked");
  const expected = before === "true" ? "false" : "true";

  // Flipping the toggle should optimistically update the UI and POST the new
  // settings to the write proxy.
  const persisted = page.waitForRequest(
    (req) => req.url().includes("/api/ui-settings") && req.method() === "POST",
  );
  await developerMode.click();
  await expect(developerMode).toHaveAttribute("aria-checked", expected);
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

  const developerMode = page.getByRole("switch", { name: "Developer Mode" });
  const before = await developerMode.getAttribute("aria-checked");

  // Wait for the rejected write to come back before asserting nothing changed.
  const response = page.waitForResponse("**/api/ui-settings");
  await developerMode.click();
  await response;

  await expect(developerMode).toHaveAttribute("aria-checked", before ?? "false");
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

test("heartbeat reports ONLINE when the service responds", async ({ page }) => {
  await page.route("**/api/heartbeat**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "online" }),
    }),
  );

  await enableDeveloperMode(page);
  await page.getByRole("button", { name: "Check Heartbeat" }).click();

  await expect(page.getByText(/ONLINE/)).toBeVisible();
});

test("heartbeat reports OFFLINE when the service is unhealthy", async ({
  page,
}) => {
  await page.route("**/api/heartbeat**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ status: "offline" }),
    }),
  );

  await enableDeveloperMode(page);
  await page.getByRole("button", { name: "Check Heartbeat" }).click();

  await expect(page.getByText("OFFLINE")).toBeVisible();
});

test("API Tools section is hidden unless developer mode is enabled", async ({
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

  const developerMode = page.getByRole("switch", { name: "Developer Mode" });
  const heartbeatButton = page.getByRole("button", { name: "Check Heartbeat" });

  // Make sure developer mode starts off, then assert the section is absent.
  if ((await developerMode.getAttribute("aria-checked")) === "true") {
    await developerMode.click();
    await expect(developerMode).toHaveAttribute("aria-checked", "false");
  }
  await expect(heartbeatButton).toBeHidden();

  // Turning it on reveals the section.
  await developerMode.click();
  await expect(developerMode).toHaveAttribute("aria-checked", "true");
  await expect(heartbeatButton).toBeVisible();
});
