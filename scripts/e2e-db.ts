// Prepares the throwaway e2e database: migrate, give the login roles their test passwords,
// empty every table and seed. Run through tsx with --conditions=react-server (server-only).
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { seed } from "@/server/seed/seed";
import * as schema from "@/server/db/schema";
import { OWNER_URL, TEST_ROLE_PASSWORD } from "../tests/integration/setup/urls";

const TABLES =
  "receipts, approvals, decisions, recommendations, payments, board_notices, evidence, signals, cases, external_anchors, ledger_entries, ledger_head, settings";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: OWNER_URL, max: 1 });
  try {
    const db = drizzle({ client: pool, schema });
    await migrate(db, { migrationsFolder: path.resolve("drizzle") });
    for (const role of ["app_rw", "demo_admin"]) {
      const { rows } = await pool.query<{ stmt: string }>(
        "SELECT format('ALTER ROLE %I PASSWORD %L', $1::text, $2::text) AS stmt",
        [role, TEST_ROLE_PASSWORD],
      );
      await pool.query(rows[0]!.stmt);
    }
    await pool.query(`TRUNCATE ${TABLES} RESTART IDENTITY CASCADE`);
    await db.transaction((tx) => seed(tx));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
