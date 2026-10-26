import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Actor } from "@/domain/types";
import { challengeFlags } from "../db/schema";
import { Conflict, NotFound } from "../errors";
import { runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({
  flagId: z.uuid(),
  resolution: z.string().trim().min(5).max(2000),
});

/** Only ACC and IA close a challenge; the case owner (SA/CISO) cannot (US-18). */
export const resolveFlagCommand: CommandDef<z.infer<typeof schema>, void> = {
  action: "resolveFlag",
  schema,
  handler: async ({ tx, actor, log }, { flagId, resolution }) => {
    const rows = await tx
      .update(challengeFlags)
      .set({ status: "resolved", resolvedBy: actor.id, resolution })
      .where(
        and(eq(challengeFlags.id, flagId), eq(challengeFlags.status, "open")),
      )
      .returning({ caseId: challengeFlags.caseId });
    if (rows.length === 0) {
      const [f] = await tx
        .select({ id: challengeFlags.id })
        .from(challengeFlags)
        .where(eq(challengeFlags.id, flagId));
      if (!f) throw new NotFound();
      throw new Conflict("flag is already resolved");
    }
    await log("FLAG_RESOLVED", { flagId, caseId: rows[0]!.caseId, resolution });
  },
};

export const resolveFlag = (actor: Actor | null, raw: unknown) =>
  runCommand(resolveFlagCommand, actor, raw);
