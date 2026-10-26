import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Actor } from "@/domain/types";
import { cases, recommendations } from "../db/schema";
import { Conflict, NotFound } from "../errors";
import { runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({
  caseId: z.uuid(),
  proposedOutcome: z.enum(["notify_now", "notify_later", "withhold"]),
  dataTaken: z.enum(["yes", "no", "unknown"]),
  treatAs: z.enum(["incident", "bug_bounty"]),
  text: z.string().trim().min(1).max(2000),
});

/** Security recommends; it never decides (F1). One recommendation per case. */
export const recordRecommendationCommand: CommandDef<
  z.infer<typeof schema>,
  void
> = {
  action: "recordRecommendation",
  schema,
  handler: async ({ tx, actor, log }, input) => {
    const [c] = await tx
      .select({ status: cases.status })
      .from(cases)
      .where(eq(cases.id, input.caseId))
      .for("update");
    if (!c) throw new NotFound();
    if (c.status !== "open") throw new Conflict("case is not open");
    // recommendations is insert-only for app_rw and has no timestamp, so there is no "latest".
    const [prior] = await tx
      .select({ id: recommendations.id })
      .from(recommendations)
      .where(eq(recommendations.caseId, input.caseId))
      .limit(1);
    if (prior) throw new Conflict("a recommendation is already recorded");
    await tx.insert(recommendations).values({ ...input, authorId: actor.id });
    await log("RECOMMENDATION_RECORDED", {
      caseId: input.caseId,
      proposedOutcome: input.proposedOutcome,
      dataTaken: input.dataTaken,
      treatAs: input.treatAs,
    });
  },
};

export const recordRecommendation = (actor: Actor | null, raw: unknown) =>
  runCommand(recordRecommendationCommand, actor, raw);
