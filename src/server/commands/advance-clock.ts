import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Actor } from "@/domain/types";
import { demoSettings } from "../db/schema";
import { assertDemoMode } from "../demo";
import { runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({ hours: z.number().int().min(1).max(168) });

export const advanceClockCommand: CommandDef<z.infer<typeof schema>, void> = {
  action: "advanceClock",
  schema,
  handler: async ({ tx, log }, { hours }) => {
    await tx
      .update(demoSettings)
      .set({ offsetMs: sql`${demoSettings.offsetMs} + ${hours * 3_600_000}` })
      .where(sql`${demoSettings.id} = 1`);
    await log("CLOCK_ADVANCED", { hours });
  },
};

export const advanceClock = async (actor: Actor | null, raw: unknown) => {
  assertDemoMode();
  return runCommand(advanceClockCommand, actor, raw);
};
