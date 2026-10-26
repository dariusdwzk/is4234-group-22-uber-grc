import "server-only";
import { and, eq } from "drizzle-orm";
import { tier1Body } from "@/domain/board-text";
import { deriveFacts } from "@/domain/facts";
import { loadRulePack } from "@/domain/rule-pack";
import { evaluate } from "@/domain/rules";
import type { Tier } from "@/domain/types";
import {
  boardItems,
  cases,
  challengeFlags,
  intakeEvents,
  ruleEvaluations,
} from "../db/schema";
import type { CommandCtx } from "../run-command";

/**
 * Re-evaluates a case from all of its events. The tier only rises. Becoming HIGH creates the
 * Tier 1 board item in this same transaction (US-16); a case that stays LOW is auto-closed.
 */
export async function classifyCase(
  ctx: CommandCtx,
  caseId: string,
): Promise<{ tier: Tier; firedRuleIds: string[]; becameHigh: boolean }> {
  const { tx, now, log } = ctx;
  const [c] = await tx.select().from(cases).where(eq(cases.id, caseId));
  if (!c) throw new Error(`case ${caseId} not found`);
  const events = await tx
    .select()
    .from(intakeEvents)
    .where(eq(intakeEvents.caseId, caseId));
  const flags = await tx
    .select({ id: challengeFlags.id })
    .from(challengeFlags)
    .where(
      and(eq(challengeFlags.caseId, caseId), eq(challengeFlags.status, "open")),
    );

  const pack = loadRulePack("v1");
  const facts = deriveFacts(events, {
    pack,
    openChallengeFlag: flags.length > 0,
  });
  const result = evaluate(pack, facts);

  await tx.insert(ruleEvaluations).values({
    caseId,
    rulePackVersion: pack.version,
    firedRuleIds: result.firedRuleIds,
    tier: result.tier,
    evaluatedAt: now,
  });

  const tier: Tier =
    c.tier === "HIGH" || result.tier === "HIGH" ? "HIGH" : "LOW";
  const becameHigh = c.tier === "LOW" && tier === "HIGH";
  const status =
    tier === "LOW" && c.status === "open" ? "auto_closed" : c.status;
  await tx
    .update(cases)
    .set({ tier, status, ...(becameHigh ? { highSince: now } : {}) })
    .where(eq(cases.id, caseId));
  await log("CASE_CLASSIFIED", {
    caseId,
    tier,
    firedRuleIds: result.firedRuleIds,
    rulePackVersion: pack.version,
  });

  if (becameHigh) {
    const dataCategories = [
      ...(facts.personalDataAccessed ? ["personal data"] : []),
      ...(facts.amountCents > 0 ? ["payment details"] : []),
    ];
    await tx.insert(boardItems).values({
      caseId,
      tier: 1,
      reasonKey: "tier1",
      body: tier1Body({
        ref: c.ref,
        source: c.source,
        firedRuleIds: result.firedRuleIds,
        dataCategories,
        detectedAt: c.detectedAt.toISOString(),
      }),
    });
    await log("TIER1_CREATED", { caseId, ref: c.ref });
  }
  return { tier, firedRuleIds: result.firedRuleIds, becameHigh };
}
