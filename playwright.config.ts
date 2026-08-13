import { defineConfig, devices } from "@playwright/test";

// Env-overridable so the release gate can point the suite at a remapped stack
// (see the api repo's dockerCompose/compose.e2e.yaml); defaults keep local use unchanged.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // Run tests in files in parallel.
  fullyParallel: true,
  // Fail the build on CI if test.only is left in the source.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    // Collect a trace when retrying a failed test.
    trace: "on-first-retry",
  },
  // Form-factor convention (see localFiles/adaptive_rollout.md, Phase 0):
  // untagged specs are desktop-only and run on the three desktop projects;
  // specs with "@mobile" in their title run only on the mobile project.
  // Mobile coverage is added as "@mobile" twins of the desktop specs rather
  // than by rerunning desktop specs at a phone size.
  //
  // The "setup" project registers a trial account and saves its storageState
  // (e2e/auth.setup.ts); specs that write data opt in with
  // `test.use({ storageState: AUTH_STATE })`. Anonymous browsers are guests
  // (read-only showcase view), so guest specs simply don't opt in.
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, grepInvert: /@mobile/, dependencies: ["setup"] },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, grepInvert: /@mobile/, dependencies: ["setup"] },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, grepInvert: /@mobile/, dependencies: ["setup"] },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] }, grep: /@mobile/, dependencies: ["setup"] },
  ],
  // Start the Next.js dev server before the tests, reusing one if already running.
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
