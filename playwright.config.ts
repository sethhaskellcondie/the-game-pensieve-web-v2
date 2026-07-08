import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3000";

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
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, grepInvert: /@mobile/ },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, grepInvert: /@mobile/ },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, grepInvert: /@mobile/ },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  // Start the Next.js dev server before the tests, reusing one if already running.
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
