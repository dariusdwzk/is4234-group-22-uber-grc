import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { TRIAGE_STATUS } from "@/domain/escalations";
import type { Actor } from "@/domain/types";
import { getCaseFor } from "../cases/engine";
import { cases } from "../db/schema";
import { Conflict } from "../errors";
import { caseIdOf, runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({
  caseId: z.string(),
  text: z.string().trim().max(2000),
  /** Triage only: what Security established. The rating stays with the CPO. */
  facts: z
    .strictObject({
      dataAccessed: z.boolean(),
      moneyConcern: z.boolean(),
      harmConcern: z.boolean(),
    })
    .optional(),
});

/**
 * Security records what the investigation confirmed (mockup: A.finding). On a staff report
 * waiting for triage it also records the facts; on a LOW staff report it is the review.
 */
export const recordFindingCommand: CommandDef<z.infer<typeof schema>, void> = {
  action: "recordFinding",
  blocked: "Blocked: Add finding",
  schema,
  handler: async (ctx, { caseId, text, facts }) => {
    const { tx, log } = ctx;
    const c = await getCaseFor(ctx, caseId, { investigate: true });
    const triage = c.status === TRIAGE_STATUS;
    const review = c.route === "SECURITY_TRIAGE" && c.severity === "LOW";
    if (c.severity !== "HIGH" && !triage && !review)
      throw new Conflict("Low-risk cases need no action.");
    if (c.finding) throw new Conflict("A finding is already recorded.");
    const finding = text || "Finding recorded";
    await tx
      .update(cases)
      .set({
        finding,
        ...(triage && facts ? { facts: { ...c.facts, ...facts } } : {}),
        ...(review ? { status: "Reviewed" } : {}),
      })
      .where(eq(cases.id, caseId));
    await log("Finding recorded", caseId, finding);
  },
};

export const recordFinding = (actor: Actor | null, raw: unknown) =>
  runCommand(recordFindingCommand, actor, raw, caseIdOf(raw));
