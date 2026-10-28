import { defineConfig, devices } from "@playwright/test";
import { APP_URL, DEMO_URL, OWNER_URL } from "./tests/integration/setup/urls";

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
  projects: [
    {
      name: "chromium",
      // PW_CHANNEL=chrome runs against an installed Google Chrome instead of the bundled build.
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    port: 3000,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      DEMO_MODE: "true",
      DATABASE_URL: APP_URL,
      DEMO_ADMIN_DATABASE_URL: DEMO_URL,
      TEST_DATABASE_URL_OWNER: OWNER_URL,
    },
  },
});
