import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  checkDecision,
  gateState,
  REASON_CODES,
  type Decision,
  type DecisionRefusal,
} from "@/domain/gate";
import { isIndependent } from "@/domain/independence";
import type { Actor, Outcome } from "@/domain/types";
import { createTier2 } from "../board/tier2";
import { cases, decisions, users } from "../db/schema";
import { Conflict, Forbidden, NotFound } from "../errors";
import { runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({
  caseId: z.uuid(),
  outcome: z.enum(["notify_now", "notify_later", "withhold"]),
  notifyBy: z.iso.date().optional(),
  reasonCode: z.enum(REASON_CODES as [string, ...string[]]),
  checklist: z.strictObject({
    reviewedEvidence: z.boolean(),
    noPersonalConflict: z.boolean(),
    consideredRegulatorDeadlines: z.boolean(),
    consideredBoardNotice: z.boolean(),
    notInstructedBySecurity: z.boolean(),
  }),
});

const REFUSAL_TEXT: Record<DecisionRefusal, string> = {
  WRONG_ROLE: "only General Counsel and Privacy/Compliance may decide",
  NOT_INDEPENDENT: "approver is not independent of the CISO",
  SAME_APPROVER: "the same person cannot hold both approvals",
  CHECKLIST_INCOMPLETE: "every checklist item must be confirmed",
  NOTIFY_DATE_REQUIRED: "a notify-by date is required for notify later",
};

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** The only path by which a HIGH case closes (US-11, US-12): both keys must agree. */
export const submitDecisionCommand: CommandDef<z.infer<typeof schema>, void> = {
  action: "submitDecision",
  schema,
  handler: async (ctx, input) => {
    const { tx, actor, now, log } = ctx;
    const [c] = await tx
      .select()
      .from(cases)
      .where(eq(cases.id, input.caseId))
      .for("update");
    if (!c) throw new NotFound();
    if (c.status !== "open") throw new Conflict("case is not open");

    const people = await tx
      .select({ id: users.id, reportsTo: users.reportsTo, role: users.role })
      .from(users);
    const reportsTo = new Map(people.map((p) => [p.id, p.reportsTo]));
    const cisoIds = new Set(
      people.filter((p) => p.role === "CISO").map((p) => p.id),
    );
    const toDecision = (r: typeof decisions.$inferSelect): Decision => ({
      approverId: r.approverId,
      approverRole: r.approverRole as "GC" | "PCO",
      outcome: r.outcome,
      notifyBy: day(r.notifyBy),
      reasonCode: r.reasonCode as Decision["reasonCode"],
    });
    const existing = (
      await tx.select().from(decisions).where(eq(decisions.caseId, c.id))
    ).map(toDecision);

    const notifyBy =
      input.outcome === "notify_later" ? (input.notifyBy ?? null) : null;
    if (notifyBy) {
      const today = day(now)!;
      const latest = day(new Date(now.getTime() + 365 * 86_400_000))!;
      if (notifyBy < today || notifyBy > latest)
        throw new Forbidden(
          "NOTIFY_DATE_INVALID: notify-by must be between today and one year ahead",
        );
    }
    const check = checkDecision({
      approver: actor,
      independent: isIndependent(actor.id, reportsTo, cisoIds),
      checklist: input.checklist,
      outcome: input.outcome,
      notifyBy,
      existing,
    });
    // Throwing rolls this transaction back; runCommand then logs REFUSED in its own one.
    if (!check.ok)
      throw new Forbidden(`${check.reason}: ${REFUSAL_TEXT[check.reason]}`);

    const approverRole = actor.role as "GC" | "PCO";
    const values = {
      caseId: c.id,
      approverId: actor.id,
      approverRole,
      outcome: input.outcome,
      notifyBy: notifyBy ? new Date(`${notifyBy}T00:00:00.000Z`) : null,
      reasonCode: input.reasonCode,
      checklist: input.checklist,
    };
    await tx
      .insert(decisions)
      .values(values)
      .onConflictDoUpdate({
        target: [decisions.caseId, decisions.approverRole],
        set: values,
      });
    await log("DECISION_SUBMITTED", {
      caseId: c.id,
      approverRole,
      outcome: input.outcome,
      notifyBy,
      reasonCode: input.reasonCode,
      checklist: input.checklist,
    });

    const all = (
      await tx.select().from(decisions).where(eq(decisions.caseId, c.id))
    ).map(toDecision);
    const state = gateState(all);
    if (state.status === "agreed") {
      await tx
        .update(cases)
        .set({
          status: "closed",
          outcome: state.outcome as Outcome,
          notifyBy: state.notifyBy
            ? new Date(`${state.notifyBy}T00:00:00.000Z`)
            : null,
          closedAt: now,
        })
        .where(eq(cases.id, c.id));
      await log("CASE_CLOSED", {
        caseId: c.id,
        outcome: state.outcome,
        notifyBy: state.notifyBy,
      });
    } else if (state.status === "disagreement") {
      await createTier2(
        ctx,
        c.id,
        "disagreement",
        `Case ${c.ref}: General Counsel and Privacy/Compliance disagree on the outcome. The case stays open until they agree.`,
      );
    }
  },
};

export const submitDecision = (actor: Actor | null, raw: unknown) =>
  runCommand(submitDecisionCommand, actor, raw);
