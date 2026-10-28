import "server-only";
import { z } from "zod";
import { TRIAGE_STATUS } from "@/domain/escalations";
import type { Actor } from "@/domain/types";
import { getCase, rateHigh, rateLow, sendNotice } from "../cases/engine";
import { Conflict } from "../errors";
import { caseIdOf, runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({
  caseId: z.string(),
  rating: z.enum(["HIGH", "LOW"]),
  reason: z.string().trim().min(1).max(500),
});

/**
 * The Chief Privacy Officer confirms a staff report's rating. Security establishes the facts
 * but can never set the rating: the permissions map refuses it, and the attempt is logged.
 */
export const confirmTriageCommand: CommandDef<z.infer<typeof schema>, void> = {
  action: "confirmTriage",
  blocked: "Blocked: Confirm rating",
  schema,
  handler: async (ctx, { caseId, rating, reason }) => {
    const c = await getCase(ctx.tx, caseId);
    if (c.status !== TRIAGE_STATUS)
      throw new Conflict("This case is not waiting for triage.");
    if (rating === "HIGH") {
      await rateHigh(ctx.tx, caseId);
      await ctx.log(
        "Triage rating confirmed by Chief Privacy Officer: HIGH",
        caseId,
        reason,
      );
      await sendNotice(ctx, caseId, 1, "t1");
    } else {
      await rateLow(ctx.tx, caseId, ctx.now);
      await ctx.log(
        "Triage rating confirmed by Chief Privacy Officer: LOW",
        caseId,
        reason,
      );
    }
  },
};

export const confirmTriage = (actor: Actor | null, raw: unknown) =>
  runCommand(confirmTriageCommand, actor, raw, caseIdOf(raw));
