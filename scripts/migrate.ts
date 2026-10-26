// Applies drizzle/ migrations as the owner role. Usage: npm run db:migrate
// Reads DATABASE_URL_OWNER from the environment or .env.local; never commit that URL.
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: rely on the real environment
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_OWNER;
  if (!url) throw new Error("DATABASE_URL_OWNER is not set");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), {
      migrationsFolder: path.resolve("drizzle"),
    });
    console.log("migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
