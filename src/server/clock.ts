import "server-only";
import { eq } from "drizzle-orm";
import { db, type DbClient } from "./db/client";
import { demoSettings } from "./db/schema";

/** Real time, plus the demo offset when (and only when) DEMO_MODE=true. */
export async function getNow(client: DbClient = db): Promise<Date> {
  const real = Date.now();
  if (process.env.DEMO_MODE !== "true") return new Date(real);
  const [row] = await client
    .select({ offsetMs: demoSettings.offsetMs })
    .from(demoSettings)
    .where(eq(demoSettings.id, 1));
  return new Date(real + (row?.offsetMs ?? 0));
}
