import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { OWNER_URL, TEST_ROLE_PASSWORD } from "./urls";

// Runs once before the integration suite: apply migrations as owner, then give the two
// login roles their test-only passwords (the migration deliberately sets none).
export default async function setup(): Promise<void> {
  const pool = new Pool({ connectionString: OWNER_URL, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), {
      migrationsFolder: path.resolve(__dirname, "../../../drizzle"),
    });
    for (const role of ["app_rw", "demo_admin"]) {
      const { rows } = await pool.query<{ stmt: string }>(
        "SELECT format('ALTER ROLE %I PASSWORD %L', $1::text, $2::text) AS stmt",
        [role, TEST_ROLE_PASSWORD],
      );
      await pool.query(rows[0]!.stmt);
    }
  } finally {
    await pool.end();
  }
}
