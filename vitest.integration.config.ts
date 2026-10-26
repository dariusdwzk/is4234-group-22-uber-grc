import { defineConfig } from "vitest/config";
import path from "node:path";
import { APP_URL, DEMO_URL } from "./tests/integration/setup/urls";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/setup/global-setup.ts"],
    setupFiles: ["tests/integration/setup/vitest-setup.ts"],
    // One shared database: files must not run concurrently.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: APP_URL,
      DEMO_ADMIN_DATABASE_URL: DEMO_URL,
    },
  },
});
