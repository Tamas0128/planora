import { defineConfig, devices } from "@playwright/test";
import path from "path";

// Local dev credentials live in the repo-root .env (consumed by docker-compose);
// load them here so nothing is hardcoded in the spec files.
try {
  process.loadEnvFile(path.resolve(__dirname, "../.env"));
} catch {
  // .env not present — tests will fail fast with a clear "ADMIN_PASSWORD not set" message
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
