import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  ESCALATED_STATUS,
  otherApprover,
  voteOutcome,
  type Approver,
} from "@/domain/gate";
import { ROLES } from "@/domain/roles";
import type { Actor } from "@/domain/types";
import { getCase, runEscalations, sendNotice } from "../cases/engine";
import { approvals, cases, decisions, recommendations } from "../db/schema";
import { Conflict, Forbidden } from "../errors";
import { anchorHead } from "../ledger/anchor";
import { caseIdOf, runCommand, type CommandDef } from "../run-command";
import { markDisclosed } from "./disclose";

const schema = z.strictObject({
  caseId: z.string(),
  vote: z.enum(["approve", "reject"]),
  reason: z.enum([
    "Facts support it",
    "Facts contradict it",
    "Regulator must be told",
  ]),
  // The checklist box must be ticked: the server refuses an unticked vote.
  checklist: z.literal(true),
});

/** One of the two keys (mockup: A.vote). One vote per person, enforced by a unique constraint. */
export const voteCommand: CommandDef<z.infer<typeof schema>, void> = {
  action: "vote",
  blocked: "Blocked: Approve",
  schema,
  handler: async (ctx, { caseId, vote, reason }) => {
    const { tx, now, actor, log } = ctx;
    const voter = actor.role as Approver;
    const c = await getCase(tx, caseId);
    const [d] = await tx
      .select()
      .from(decisions)
      .where(eq(decisions.caseId, caseId));
    if (!d || d.status !== "Pending")
      throw new Conflict("No decision is pending.");
    const votes = await tx
      .select()
      .from(approvals)
      .where(eq(approvals.caseId, caseId));
    if (votes.some((v) => v.role === voter))
      throw new Conflict("You have already voted.");
    const independent = c.route === "INDEPENDENT";
    const [rec] = await tx
      .select()
      .from(recommendations)
      .where(eq(recommendations.caseId, caseId));
    // Independent path: the recommender's key is their recommendation; the other one decides.
    if (independent && rec?.authorRole === voter)
      throw new Forbidden(
        "You recommended this, so the " +
          ROLES[otherApprover(voter)].name +
          " must decide.",
        { caseId },
      );

    await tx
      .insert(approvals)
      .values({ caseId, role: voter, vote, reason, createdH: now });
    await log(
      vote === "approve" ? "Approved" : "Rejected",
      caseId,
      d.type + ". " + reason + ".",
    );

    const other = independent
      ? "approve"
      : (votes.find((v) => v.role !== voter)?.vote ?? null);
    const outcome = voteOutcome(d, voter, vote, other);
    const sys = { actor: "System" };
    const resolve = (status: "Approved" | "Rejected") =>
      tx
        .update(decisions)
        .set({ status, resolvedH: now })
        .where(eq(decisions.caseId, caseId));

    if (outcome.kind === "rejected") {
      await resolve("Rejected");
      await tx
        .update(cases)
        .set({ status: "Disclosure required" })
        .where(eq(cases.id, caseId));
      await sendNotice(
        ctx,
        caseId,
        2,
        "rejected",
        actor.name +
          " rejected the recommendation on " +
          c.id +
          ". Disclosure is required.",
      );
    } else if (outcome.kind === "disclosed") {
      await resolve("Approved");
      await markDisclosed(ctx, caseId);
    } else if (outcome.kind === "escalated") {
      // Both keys agreed to investigate further. The clocks keep running and the board is
      // told; GC or CPO can still approve disclosure later.
      await resolve("Approved");
      await tx
        .update(cases)
        .set({ status: ESCALATED_STATUS })
        .where(eq(cases.id, caseId));
      await sendNotice(
        ctx,
        caseId,
        2,
        "escalated",
        "General Counsel and Chief Privacy Officer agreed to escalate " +
          c.id +
          " internally for further investigation. Disclosure has not been made.",
      );
      await log(
        "Approved by both approvers",
        caseId,
        "Escalated internally. Decision recorded permanently.",
        sys,
      );
      await anchorHead(tx, now, "After escalation decision");
    } else {
      await tx
        .update(cases)
        .set({ status: outcome.caseStatus })
        .where(eq(cases.id, caseId));
    }
    await runEscalations(ctx);
  },
};

export const castVote = (actor: Actor | null, raw: unknown) =>
  runCommand(voteCommand, actor, raw, caseIdOf(raw));
