import "server-only";
import { eq } from "drizzle-orm";
import { db, type DbClient } from "./db/client";
import { settings } from "./db/schema";

/** Demo "now" in hours since Day 0. The only source of time for the app. */
export async function getNow(client: DbClient = db): Promise<number> {
  const [row] = await client
    .select({ clockH: settings.clockH })
    .from(settings)
    .where(eq(settings.id, 1));
  return row?.clockH ?? 0;
}
