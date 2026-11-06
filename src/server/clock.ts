import "server-only";
import { eq } from "drizzle-orm";
import { wallClockH } from "@/domain/demo-time";
import { db, type DbClient } from "./db/client";
import { settings } from "./db/schema";

/**
 * The real time in demo hours. Tests set DEMO_FROZEN_CLOCK=true to pin it at 0, so the demo
 * clock only moves when a test moves it.
 */
export const wallNow = (): number =>
  process.env.DEMO_FROZEN_CLOCK === "true" ? 0 : wallClockH();

/** Demo "now": the real time plus the offset in settings (tests move it with advanceClock). */
export async function getNow(client: DbClient = db): Promise<number> {
  const [row] = await client
    .select({ clockH: settings.clockH })
    .from(settings)
    .where(eq(settings.id, 1));
  return wallNow() + (row?.clockH ?? 0);
}
