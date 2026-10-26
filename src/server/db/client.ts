import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Either the pool-backed db or an open transaction. */
export type DbClient = Db | Tx;

// Cached on globalThis so Next dev hot reloads do not leak pools.
const g = globalThis as unknown as { __grcAppPool?: Pool };

function appPool(): Pool {
  if (!g.__grcAppPool) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
    pool.on("error", (err) => console.error("pg pool error", err.message));
    g.__grcAppPool = pool;
  }
  return g.__grcAppPool;
}

/** app_rw connection. The pool connects lazily, so importing this at build time is safe. */
export const db: Db = drizzle({ client: appPool(), schema });
