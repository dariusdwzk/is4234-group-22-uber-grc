import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { GENESIS_PREV_HASH } from "@/domain/hash";
import * as schema from "@/server/db/schema";
import { APP_URL, DEMO_URL, OWNER_URL } from "./urls";

export const ownerPool = new Pool({ connectionString: OWNER_URL, max: 2 });
export const appPool = new Pool({ connectionString: APP_URL, max: 2 });
export const demoPool = new Pool({ connectionString: DEMO_URL, max: 2 });

export const ownerDb = drizzle({ client: ownerPool, schema });
export const appDb = drizzle({ client: appPool, schema });
export const demoDb = drizzle({ client: demoPool, schema });

const TABLES = [
  "receipts",
  "approvals",
  "decisions",
  "recommendations",
  "payments",
  "challenge_flags",
  "board_notices",
  "evidence",
  "signals",
  "cases",
  "external_anchors",
  "ledger_entries",
  "ledger_head",
  "settings",
];

/** Truncates everything as owner and re-seeds the two single-row tables. */
export async function resetTestDb(): Promise<void> {
  await ownerPool.query(
    `TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`,
  );
  await ownerPool.query(
    "INSERT INTO ledger_head (id, seq, hash) VALUES (1, 0, $1)",
    [GENESIS_PREV_HASH],
  );
  await ownerPool.query("INSERT INTO settings (id, clock_h) VALUES (1, 0)");
}

/** Edits a ledger row as owner with the append-only trigger off: simulates an attacker with DB access. */
export async function tamperAsOwner(
  statement: string,
  params: unknown[] = [],
): Promise<void> {
  const c = await ownerPool.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      "ALTER TABLE ledger_entries DISABLE TRIGGER ledger_entries_append_only",
    );
    await c.query(statement, params);
    await c.query(
      "ALTER TABLE ledger_entries ENABLE TRIGGER ledger_entries_append_only",
    );
    await c.query("COMMIT");
  } catch (err) {
    await c.query("ROLLBACK");
    throw err;
  } finally {
    c.release();
  }
}

export async function closeAll(): Promise<void> {
  const g = globalThis as unknown as { __grcAppPool?: Pool };
  await Promise.allSettled([
    ownerPool.end(),
    appPool.end(),
    demoPool.end(),
    g.__grcAppPool?.end(),
  ]);
}
