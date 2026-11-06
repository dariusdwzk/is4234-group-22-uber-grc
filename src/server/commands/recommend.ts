import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  decisionFor,
  independentDecisionFor,
  type Approver,
} from "@/domain/gate";
import type { Actor, RoleKey } from "@/domain/types";
import { getCaseFor } from "../cases/engine";
import { cases, decisions, recommendations } from "../db/schema";
import { Conflict } from "../errors";
import { caseIdOf, runCommand, type CommandDef } from "../run-command";

const schema = z
  .strictObject({
    caseId: z.string(),
    action: z.enum(["escalate", "disclose"]),
    reason: z.string().trim().max(1000).optional(),
  })
  // Holding back disclosure always needs a stated reason; it goes on the record.
  .refine((r) => r.action !== "escalate" || !!r.reason, {
    message: "Give a reason for escalating internally.",
    path: ["reason"],
  });

/**
 * Security or the CSO recommends; that opens the decision the approvers must take
 * (mockup: A.rec). On an INDEPENDENT case the GC or CPO recommends, and the other one decides.
 */
export const recommendCommand: CommandDef<z.infer<typeof schema>, void> = {
  action: "recommend",
  blocked: "Blocked: Send recommendation",
  schema,
  handler: async (ctx, { caseId, action, reason }) => {
    const { tx, now, actor, log } = ctx;
    const c = await getCaseFor(ctx, caseId, { investigate: true });
    if (c.severity !== "HIGH")
      throw new Conflict("Low-risk cases need no action.");
    const [prev] = await tx
      .select()
      .from(recommendations)
      .where(eq(recommendations.caseId, caseId));
    if (prev) throw new Conflict("A recommendation was already sent.");

    const d =
      c.route === "INDEPENDENT"
        ? independentDecisionFor(action, actor.role as Approver)
        : decisionFor(action);
    await tx.insert(recommendations).values({
      caseId,
      authorRole: actor.role as RoleKey,
      action,
      reason: reason || null,
      createdH: now,
    });
    await tx.insert(decisions).values({
      caseId,
      type: d.type,
      need: d.need,
      disclose: d.disclose,
      createdH: now,
    });
    await tx
      .update(cases)
      .set({ status: d.caseStatus })
      .where(eq(cases.id, caseId));
    await log(
      "Recommendation sent",
      caseId,
      d.type + (reason ? ". " + reason : ""),
    );
  },
};

export const recommend = (actor: Actor | null, raw: unknown) =>
  runCommand(recommendCommand, actor, raw, caseIdOf(raw));
