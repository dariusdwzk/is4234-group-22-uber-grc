import "server-only";
import { and, eq } from "drizzle-orm";
import { computeClocks } from "@/domain/clocks";
import { gateState, type Decision } from "@/domain/gate";
import { loadRulePack } from "@/domain/rule-pack";
import { SYSTEM_ACTOR } from "@/domain/types";
import { createTier2 } from "./board/tier2";
import { cases, decisions } from "./db/schema";
import type { CommandCtx } from "./run-command";

/**
 * Runs inside every command transaction (spec §8). Any clock at or past the escalation
 * threshold on an open HIGH case without an agreed decision becomes one Tier 2 item;
 * the unique (case_id, reason_key) constraint makes repeats no-ops. Returns items created.
 */
export async function sweepEscalations(ctx: CommandCtx): Promise<number> {
  const { tx, now } = ctx;
  // Spec §8: the sweep acts as the system, whoever happened to trigger it.
  const sysCtx: CommandCtx = {
    ...ctx,
    actor: SYSTEM_ACTOR,
    log: (type, payload) =>
      ctx.log(type, payload, { actorId: SYSTEM_ACTOR.id }),
  };
  const pack = loadRulePack("v1");
  const open = await tx
    .select()
    .from(cases)
    .where(and(eq(cases.tier, "HIGH"), eq(cases.status, "open")))
    .orderBy(cases.id);
  let created = 0;
  for (const c of open) {
    const rows = await tx
      .select()
      .from(decisions)
      .where(eq(decisions.caseId, c.id));
    const state = gateState(
      rows.map((d): Decision => ({
        approverId: d.approverId,
        approverRole: d.approverRole as "GC" | "PCO",
        outcome: d.outcome,
        notifyBy: d.notifyBy?.toISOString().slice(0, 10) ?? null,
        reasonCode: d.reasonCode as Decision["reasonCode"],
      })),
    );
    if (state.status === "agreed") continue;
    const clocks = computeClocks(
      {
        detectedAt: c.detectedAt.toISOString(),
        highSince: c.highSince?.toISOString() ?? null,
        materialityDeterminedAt:
          c.materialityDeterminedAt?.toISOString() ?? null,
        closedAt: c.closedAt?.toISOString() ?? null,
        tier: c.tier,
      },
      pack,
      now,
    );
    for (const k of clocks) {
      if (k.status !== "due_soon" && k.status !== "overdue") continue;
      const body = `Case ${c.ref}: clock "${k.label}" is ${k.status === "overdue" ? "overdue" : "approaching its limit"} (${k.pctElapsed}% elapsed, due ${k.dueAt}).`;
      if (await createTier2(sysCtx, c.id, `clock:${k.id}`, body)) created++;
    }
  }
  return created;
}
