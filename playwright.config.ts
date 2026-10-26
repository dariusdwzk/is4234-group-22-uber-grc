import { defineConfig, devices } from "@playwright/test";
import { APP_URL, DEMO_URL, OWNER_URL } from "./tests/integration/setup/urls";

// Synthetic, test-only. Read by the server (reset action) and by tests/e2e/fixtures.ts.
process.env.DEMO_PASSWORD ??= "e2e-demo-password-1";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    port: 3000,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      DEMO_MODE: "true",
      DEMO_PASSWORD: process.env.DEMO_PASSWORD,
      DATABASE_URL: APP_URL,
      DEMO_ADMIN_DATABASE_URL: DEMO_URL,
      TEST_DATABASE_URL_OWNER: OWNER_URL,
    },
  },
});
