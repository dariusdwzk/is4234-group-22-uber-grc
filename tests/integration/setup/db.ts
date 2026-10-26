import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { GENESIS_PREV_HASH } from "@/domain/hash";
import type { Actor, Role } from "@/domain/types";
import * as schema from "@/server/db/schema";
import { APP_URL, DEMO_URL, OWNER_URL } from "./urls";

export const ownerPool = new Pool({ connectionString: OWNER_URL, max: 2 });
export const appPool = new Pool({ connectionString: APP_URL, max: 2 });
export const demoPool = new Pool({ connectionString: DEMO_URL, max: 2 });

export const ownerDb = drizzle({ client: ownerPool, schema });
export const appDb = drizzle({ client: appPool, schema });
export const demoDb = drizzle({ client: demoPool, schema });

const TABLES = [
  "board_items",
  "challenge_flags",
  "decisions",
  "recommendations",
  "rule_evaluations",
  "intake_events",
  "cases",
  "sessions",
  "users",
  "rule_packs",
  "head_exports",
  "ledger_entries",
  "ledger_head",
  "demo_settings",
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
  await ownerPool.query(
    "INSERT INTO demo_settings (id, offset_ms) VALUES (1, 0)",
  );
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

/** Inserts a synthetic user as owner. Pass a precomputed hash to keep tests fast. */
export async function seedUser(opts: {
  email: string;
  role: Role;
  passwordHash: string;
  displayName?: string;
}): Promise<Actor> {
  const [row] = await ownerDb
    .insert(schema.users)
    .values({
      email: opts.email,
      role: opts.role,
      displayName: opts.displayName ?? opts.role,
      passwordHash: opts.passwordHash,
    })
    .returning({ id: schema.users.id });
  return {
    id: row!.id,
    role: opts.role,
    displayName: opts.displayName ?? opts.role,
  };
}
