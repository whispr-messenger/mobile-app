import { defineConfig, devices } from "@playwright/test";

// Config Playwright pour la PWA Whispr (preprod par defaut).
// On teste sur 3 viewports : desktop chrome, iPhone Safari (webkit),
// Android Pixel (chromium emulation). Ces 3 couvrent les regressions
// scroll/layout vues sur whispr-preprod.roadmvn.com.
export default defineConfig({
  testDir: "./e2e/web-scroll",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["html", { outputFolder: "playwright-report", open: "never" }], ["list"]]
    : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "https://whispr-preprod.roadmvn.com",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // La PWA peut etre lente a hydrater au premier chargement.
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "iphone-safari",
      use: { ...devices["iPhone 14 Pro"] },
    },
    {
      name: "android-pixel",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
