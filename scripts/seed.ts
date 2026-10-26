// Seeds a freshly migrated database. Usage: npm run db:seed (needs DATABASE_URL and DEMO_PASSWORD).
import { db } from "@/server/db/client";
import { seed } from "@/server/seed/seed";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: rely on the real environment
}

async function main(): Promise<void> {
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 12)
    throw new Error("DEMO_PASSWORD must be set and at least 12 characters");
  await db.transaction((tx) => seed(tx, { demoPassword, now: new Date() }));
  console.log("seeded");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
