import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { voteOutcome, type Approver } from "@/domain/gate";
import type { Actor } from "@/domain/types";
import { getCase, runEscalations, sendNotice } from "../cases/engine";
import { approvals, cases, decisions, payments } from "../db/schema";
import { Conflict } from "../errors";
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

    await tx
      .insert(approvals)
      .values({ caseId, role: voter, vote, reason, createdH: now });
    await log(
      vote === "approve" ? "Approved" : "Rejected",
      caseId,
      d.type + ". " + reason + ".",
    );

    const other = votes.find((v) => v.role !== voter)?.vote ?? null;
    const outcome = voteOutcome(d, voter, vote, other);
    const [held] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.caseId, caseId), eq(payments.status, "Held")));
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
      if (held) {
        await tx
          .update(payments)
          .set({ status: "Cancelled" })
          .where(eq(payments.id, held.id));
        await log("Payment cancelled", caseId, "Recommendation rejected.", sys);
      }
      await sendNotice(
        ctx,
        caseId,
        2,
        "rejected",
        actor.name +
          " rejected the recommendation to limit disclosure on " +
          c.id +
          ". Payment cancelled. Disclosure is required.",
      );
    } else if (outcome.kind === "disclosed") {
      await resolve("Approved");
      await markDisclosed(ctx, caseId);
    } else if (outcome.kind === "limited") {
      await resolve("Approved");
      await tx
        .update(cases)
        .set({ status: "Disclosure limited" })
        .where(eq(cases.id, caseId));
      await sendNotice(
        ctx,
        caseId,
        2,
        "limited",
        "General Counsel and Chief Privacy Officer approved limiting disclosure on " +
          c.id +
          ". Payment of US$100,000 approved for release.",
      );
      if (held) {
        await tx
          .update(payments)
          .set({ status: "Approved for release" })
          .where(eq(payments.id, held.id));
        await log(
          "Payment hold lifted",
          caseId,
          "General Counsel and Chief Privacy Officer both approved.",
          sys,
        );
      }
      await log(
        "Approved by both approvers",
        caseId,
        "Disclosure limited. Decision recorded permanently.",
        sys,
      );
      await anchorHead(tx, now, "After limiting decision");
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
