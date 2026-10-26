// Seeds a freshly migrated database. Usage: npm run db:seed (needs DATABASE_URL and DEMO_PASSWORD).
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: rely on the real environment
}

async function main(): Promise<void> {
  // Imported after loadEnvFile: the db pool reads DATABASE_URL when the module loads.
  const { db } = await import("@/server/db/client");
  const { seed } = await import("@/server/seed/seed");
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
