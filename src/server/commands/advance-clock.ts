import "server-only";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Actor } from "@/domain/types";
import { settings } from "../db/schema";
import { assertDemoMode } from "../demo";
import { runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({ hours: z.literal(24) }); // the mockup's only step: "+1 day"

export const advanceClockCommand: CommandDef<z.infer<typeof schema>, void> = {
  action: "advanceClock",
  blocked: "Blocked: Move time",
  schema,
  handler: async ({ tx }, { hours }) => {
    await tx
      .update(settings)
      .set({ clockH: sql`${settings.clockH} + ${hours}` })
      .where(eq(settings.id, 1));
  },
};

export const advanceClock = async (actor: Actor | null, raw: unknown) => {
  assertDemoMode();
  return runCommand(advanceClockCommand, actor, raw);
};
