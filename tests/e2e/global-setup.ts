import { execFileSync } from "node:child_process";

// Seeding imports server-only modules, which only load under the react-server condition.
export default function setup(): void {
  execFileSync(
    "npx",
    ["tsx", "--conditions=react-server", "scripts/e2e-db.ts"],
    // DEMO_MODE so the seed includes the demo operator.
    { stdio: "inherit", env: { ...process.env, DEMO_MODE: "true" } },
  );
}
