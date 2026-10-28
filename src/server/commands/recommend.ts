import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { conflicts } from "@/domain/conflicts";
import { decisionFor } from "@/domain/gate";
import type { Actor, RoleKey } from "@/domain/types";
import { getCase } from "../cases/engine";
import { cases, decisions, recommendations } from "../db/schema";
import { Conflict } from "../errors";
import { caseIdOf, runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({
  caseId: z.string(),
  action: z.enum(["limit", "disclose"]),
  claims: z.strictObject({
    noData: z.boolean(),
    verified: z.boolean(),
    routine: z.boolean(),
  }),
});

/**
 * Security or the CSO recommends; that opens the decision the approvers must take.
 * Its claims are checked against the system evidence (mockup: A.rec).
 */
export const recommendCommand: CommandDef<z.infer<typeof schema>, void> = {
  action: "recommend",
  blocked: "Blocked: Send recommendation",
  schema,
  handler: async ({ tx, now, actor, log }, { caseId, action, claims }) => {
    const c = await getCase(tx, caseId);
    if (c.severity !== "HIGH")
      throw new Conflict("Low-risk cases need no action.");
    const [prev] = await tx
      .select()
      .from(recommendations)
      .where(eq(recommendations.caseId, caseId));
    if (prev) throw new Conflict("A recommendation was already sent.");

    const d = decisionFor(action);
    await tx.insert(recommendations).values({
      caseId,
      authorRole: actor.role as RoleKey,
      action,
      claims,
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
    await log("Recommendation sent", caseId, d.type);
    const cf = conflicts(claims, c.facts);
    if (cf.length)
      await log(
        "Conflicts detected",
        caseId,
        cf.length + " claims contradict system evidence.",
        { actor: "System" },
      );
  },
};

export const recommend = (actor: Actor | null, raw: unknown) =>
  runCommand(recommendCommand, actor, raw, caseIdOf(raw));
