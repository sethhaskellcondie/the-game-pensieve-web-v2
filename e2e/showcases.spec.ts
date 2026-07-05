import { test, expect, type Page } from "@playwright/test";

// Multiple-public-showcases coverage.
//
// The ungated specs exercise pure frontend surfaces (the /showcases page, the
// sidebar switcher, the login-page link) and run against any backend. The
// switching/role scenarios need the backend running with the `secured` profile
// and the seed set from the API repo's scripts/seed-test-data.sh (users
// paid1/lapsed1/seeder-admin, showcases `showcase-one`/`showcase-two`), so they
// are gated behind SECURED_BACKEND=1 like the tier specs in auth.spec.ts.
const SECURED = process.env.SECURED_BACKEND === "1";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "seeder-admin@email.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "seeder-admin";

// Open the sidebar switcher and pick an option. The click is retried until
// the menu actually opens: right after a full navigation the button can be
// visible before React has hydrated, and a pre-hydration click is swallowed.
async function chooseShowcase(page: Page, optionName: string) {
  const option = page.getByRole("option", { name: optionName });
  await expect(async () => {
    await page.getByRole("button", { name: "Switch showcase" }).click();
    await expect(option).toBeVisible({ timeout: 1500 });
  }).toPass();
  await option.click();
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("Showcase surfaces (any backend)", () => {
  test("the directory page renders with the home entry current", async ({
    page,
  }) => {
    await page.goto("/showcases");
    await expect(
      page.getByRole("heading", { name: "Public showcases" }),
    ).toBeVisible();
    // Anonymous, no selection: the home row is the default showcase and is
    // marked as the current view.
    const list = page.getByRole("list", { name: "Showcases" });
    await expect(list.getByText("Default showcase")).toBeVisible();
    await expect(list.getByText("Currently viewing")).toBeVisible();
  });

  test("the sidebar account panel offers the showcase switcher", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Switch showcase" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Browse showcases" }).first(),
    ).toBeVisible();
  });

  test("the login page links to the showcase directory", async ({ page }) => {
    await page.goto("/login");
    await page
      .getByRole("link", { name: "Explore the public showcases" })
      .click();
    await expect(page).toHaveURL(/\/showcases$/);
  });
});

test.describe("Anonymous showcase switching", () => {
  test.skip(!SECURED, "needs the secured backend + seed-test-data.sh");

  test("switches via the directory, then via the switcher, then back home", async ({
    page,
  }) => {
    // Directory → Showcase One.
    await page.goto("/showcases");
    const oneRow = page
      .getByRole("listitem")
      .filter({ hasText: "Showcase One" });
    await oneRow.getByRole("button", { name: "View" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("status", { name: "Showcase notice" })).toContainText(
      "Viewing Showcase One (read-only)",
    );
    // Showcase mode hides the personal Manage pages from the nav.
    await expect(
      page.getByRole("link", { name: "Custom Fields" }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Options" })).toHaveCount(0);
    // Read-only: no write affordance, but filtering stays available.
    await page.goto("/toys");
    await expect(page.getByRole("button", { name: "New" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Add filter" }),
    ).toBeEnabled();

    // Switcher → Showcase Two.
    await chooseShowcase(page, "Showcase Two");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("status", { name: "Showcase notice" })).toContainText(
      "Viewing Showcase Two (read-only)",
    );

    // Switcher → back to the default showcase (home state).
    await chooseShowcase(page, "Default showcase");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("status", { name: "Showcase notice" })).toContainText(
      "You’re viewing the public showcase.",
    );
  });
});

test.describe("Authenticated showcase viewing", () => {
  test.skip(!SECURED, "needs the secured backend + seed-test-data.sh");

  test("a paid user views a showcase read-only and returns to their collection", async ({
    page,
  }) => {
    await login(page, "paid1@email.com", "paid1");

    // Own collection: writable.
    await page.goto("/toys");
    await expect(page.getByRole("button", { name: "New" })).toBeVisible();

    // Enter Showcase One from the directory.
    await page.goto("/showcases");
    await page
      .getByRole("listitem")
      .filter({ hasText: "Showcase One" })
      .getByRole("button", { name: "View" })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("status", { name: "Showcase notice" })).toContainText(
      "Viewing Showcase One (read-only)",
    );

    // Read-only while viewing, though the account itself stays logged in.
    await page.goto("/toys");
    await expect(page.getByRole("button", { name: "New" })).toHaveCount(0);
    await expect(page.getByLabel("Plan: Paid")).toBeVisible();

    // Back to my collection restores the home state and write access.
    await page
      .getByRole("button", { name: "Back to my collection" })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("status", { name: "Showcase notice" })).toHaveCount(0);
    await page.goto("/toys");
    await expect(page.getByRole("button", { name: "New" })).toBeVisible();
  });
});

test.describe("Admin showcase management", () => {
  test.skip(!SECURED, "needs the secured backend + seed-test-data.sh");

  // Grants mutate shared backend state: use run-unique slugs and always clear
  // the grant again, so re-runs and parallel projects don't collide.
  test("granting a showcase lists it in the directory; clearing removes it", async ({
    page,
  }) => {
    const slug = `e2e-grant-${Date.now()}`;
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/admin");

    const row = page.getByRole("row").filter({ hasText: "paid2@email.com" });
    await row
      .getByRole("button", { name: "Edit showcase for paid2@email.com" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Display name").fill("E2E Grant");
    await dialog.getByLabel("Slug").fill(slug);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row.getByText(`(${slug})`)).toBeVisible();

    try {
      // A PAID owner's grant is publicly visible immediately.
      await page.goto("/showcases");
      await expect(page.getByText("E2E Grant")).toBeVisible();
    } finally {
      // Clear the grant (cleanup) and confirm it leaves the directory.
      await page.goto("/admin");
      await row
        .getByRole("button", { name: "Edit showcase for paid2@email.com" })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Clear showcase" })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await page.goto("/showcases");
    await expect(page.getByText("E2E Grant")).toHaveCount(0);
  });

  test("a non-PAID owner's grant is reserved but absent from the directory", async ({
    page,
  }) => {
    const slug = `e2e-dark-${Date.now()}`;
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/admin");

    const row = page
      .getByRole("row")
      .filter({ hasText: "lapsed1@email.com" });
    await row
      .getByRole("button", { name: "Edit showcase for lapsed1@email.com" })
      .click();
    const dialog = page.getByRole("dialog");
    // The dialog itself warns that the grant won't be publicly visible.
    await dialog.getByLabel("Display name").fill("E2E Dark");
    await dialog.getByLabel("Slug").fill(slug);
    await expect(
      dialog.getByText(/not publicly visible — the owner’s role is LAPSED/),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);

    try {
      // Reserved (shown in the admin grid, flagged dark)…
      await expect(row.getByText(`(${slug})`)).toBeVisible();
      await expect(row.getByText("not visible")).toBeVisible();
      // …but absent from the public directory.
      await page.goto("/showcases");
      await expect(page.getByText("E2E Dark")).toHaveCount(0);
    } finally {
      await page.goto("/admin");
      await row
        .getByRole("button", { name: "Edit showcase for lapsed1@email.com" })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Clear showcase" })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });
});
