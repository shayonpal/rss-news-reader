import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration for RSS News Reader
 * RR-184: Build Playwright E2E testing infrastructure for cross-browser validation
 *
 * Primary focus: Safari on iPhone and PWA on both iPhone and iPad running iOS 26
 * Network requirement: Tests require Tailscale VPN connection
 */

export default defineConfig({
  // Test directory containing all E2E tests
  testDir: "./src/__tests__/e2e",

  // Run tests in parallel for speed
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI for more stable results
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
    ...(process.env.CI ? [["github"] as const] : []),
  ],

  // Shared settings for all projects
  use: {
    // Base URL for Tailscale network access
    baseURL: "http://100.96.166.53:3000/reader",

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Video on failure
    video: "retain-on-failure",

    // Timeout for each test
    actionTimeout: 15000,

    // Ignore HTTPS errors (for local development)
    ignoreHTTPSErrors: true,
  },

  // Configure projects for multiple browsers
  projects: [
    // Desktop browsers
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },

    // Mobile browsers - Primary focus per requirements
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "Mobile Safari Pro",
      use: { ...devices["iPhone 14 Pro Max"] },
    },
    {
      name: "iPad Safari",
      use: { ...devices["iPad (gen 7)"] },
    },
    {
      name: "iPad Pro Safari",
      use: { ...devices["iPad Pro 11"] },
    },

    // Edge cases
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],

  // Run local dev server before starting the tests if not in CI
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev:network",
        url: "http://100.96.166.53:3000/reader",
        reuseExistingServer: true,
        timeout: 120 * 1000,
      },

  // Global test timeout
  timeout: 30000,

  // Global setup/teardown
  globalSetup: undefined,
  globalTeardown: undefined,

  // Output folder for test artifacts
  outputDir: "test-results/",
});
