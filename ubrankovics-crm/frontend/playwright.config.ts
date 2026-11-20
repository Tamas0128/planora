import { defineConfig, devices } from "@playwright/test";

const STORAGE_STATE = "e2e/.auth/admin.json";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://localhost:3101",
    trace: "retain-on-failure",
    screenshot: "on",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium-desktop",
      dependencies: ["setup"],
      testIgnore: [/01-auth\.spec\.ts/, /nonfunctional\.spec\.ts/],
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
    },
    {
      // 01-auth.spec.ts deliberately starts unauthenticated to test the login flow itself.
      name: "chromium-auth",
      testMatch: /01-auth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      dependencies: ["setup"],
      testMatch: /nonfunctional\.spec\.ts/,
      use: { ...devices["Pixel 7"], storageState: STORAGE_STATE },
    },
  ],
});
