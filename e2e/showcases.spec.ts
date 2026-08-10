import { test, expect, type Page } from "@playwright/test";
import { loginViaKeycloak } from "./keycloakLogin";

// Multiple-public-showcases coverage.
//
// The public showcase directory page has been removed; switching now happens
// solely through the account-page switcher (Account → Showcase). These
// switching/role scenarios need the backend running with the `secured` profile
// and the seed set from the API repo's scripts/seed-test-data.sh (users
// paid1/lapsed1/seeder-admin, showcases `showcase-one`/`showcase-two`), so they
// are gated behind SECURED_BACKEND=1 like the tier specs in auth.spec.ts.
const SECURED = process.env.SECURED_BACKEND === "1";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "seeder-admin@email.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "seeder-admin";

// Open the account-page switcher and pick an option. The click is retried until
// the menu actually opens: right after a full navigation the button can be
// visible before React has hydrated, and a pre-hydration click is swallowed.
async function chooseShowcase(page: Page, optionName: string) {
  await page.goto("/account");
  const option = page.getByRole("option", { name: optionName });
  await expect(async () => {
    await page.getByRole("button", { name: "Switch showcase" }).click();
    await expect(option).toBeVisible({ timeout: 1500 });
  }).toPass();
  await option.click();
}

// Whether the given showcase name is listed as an option in the account-page
// switcher (which is populated from the public /api/showcases directory).
async function switcherHasOption(page: Page, optionName: string) {
  await page.goto("/account");
  await page.getByRole("button", { name: "Switch showcase" }).click();
  return page.getByRole("option", { name: optionName });
}

async function login(page: Page, email: string, password: string) {
  // Sign-in goes through Keycloak's hosted login (the in-app password form is
  // gone); the seeded accounts exist in Keycloak with these credentials.
  await loginViaKeycloak(page, email, password);
}

test.describe("Authenticated showcase viewing", () => {
  test.skip(!SECURED, "needs the secured backend + seed-test-data.sh");

  test("a paid user views a showcase read-only and returns to their collection", async ({
    page,
  }) => {
    await login(page, "paid1@email.com", "paid1");

    // Own collection: writable.
    await page.goto("/toys");
    await expect(page.getByRole("button", { name: "New" })).toBeVisible();

    // Enter Showcase One via the account-page switcher.
    await chooseShowcase(page, "Showcase One");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("status", { name: "Showcase notice" })).toContainText(
      "Viewing Showcase One (read-only)",
    );
    // Showcase mode hides the viewer's own Options page from the nav; Custom
    // Fields stays — a showcase's fields are collection data, shown read-only
    // like Systems and the rest (see the Sidebar's showcase-mode comment).
    await expect(
      page.getByRole("link", { name: "Custom Fields" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Options" })).toHaveCount(0);

    // Read-only while viewing, though the account itself stays logged in.
    await page.goto("/toys");
    await expect(page.getByRole("button", { name: "New" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Add filter" }),
    ).toBeEnabled();
    await expect(page.getByLabel("Plan: Paid")).toBeVisible();

    // Switcher → Showcase Two.
    await chooseShowcase(page, "Showcase Two");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("status", { name: "Showcase notice" })).toContainText(
      "Viewing Showcase Two (read-only)",
    );

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
  test("granting a showcase lists it in the switcher; clearing removes it", async ({
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
      // A PAID owner's grant is publicly visible immediately — it shows up as a
      // switcher option.
      await expect(await switcherHasOption(page, "E2E Grant")).toBeVisible();
    } finally {
      // Clear the grant (cleanup) and confirm it leaves the switcher.
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
    await expect(await switcherHasOption(page, "E2E Grant")).toHaveCount(0);
  });

  test("a non-PAID owner's grant is reserved but absent from the switcher", async ({
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
      // …but absent from the public switcher.
      await expect(await switcherHasOption(page, "E2E Dark")).toHaveCount(0);
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
