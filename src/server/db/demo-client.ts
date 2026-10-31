import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { NotFound } from "../errors";
import type { Db } from "./client";
import * as schema from "./schema";

const g = globalThis as unknown as { __grcDemoDb?: Db };

/** demo_admin connection. 404s unless DEMO_MODE=true so production cannot reach reset. */
export function getDemoDb(): Db {
  if (process.env.DEMO_MODE !== "true") throw new NotFound();
  if (!g.__grcDemoDb) {
    const url = process.env.DEMO_ADMIN_DATABASE_URL;
    if (!url) throw new Error("DEMO_ADMIN_DATABASE_URL is not set");
    const pool = new Pool({ connectionString: url, max: 2 });
    pool.on("error", (err) => console.error("pg demo pool error", err.message));
    g.__grcDemoDb = drizzle({ client: pool, schema });
  }
  return g.__grcDemoDb;
}
