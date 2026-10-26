import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { computeClocks, type ClockState } from "@/domain/clocks";
import { detectConflicts, type Conflict } from "@/domain/conflicts";
import { deriveFacts, type CaseFacts } from "@/domain/facts";
import { gateState, type Decision, type GateState } from "@/domain/gate";
import { loadRulePack } from "@/domain/rule-pack";
import type { Actor, CaseStatus, EventKind, Tier } from "@/domain/types";
import { authorize, type Action } from "../authz";
import { getNow } from "../clock";
import { db } from "../db/client";
import {
  boardItems,
  cases,
  challengeFlags,
  decisions,
  intakeEvents,
  recommendations,
  ruleEvaluations,
  users,
} from "../db/schema";
import { Forbidden, NotFound } from "../errors";
import { logRefusal } from "../run-command";

export type CaseListItem = {
  id: string;
  ref: string;
  tier: Tier;
  status: CaseStatus;
  source: "manual" | "simulator";
  detectedAt: string;
  firedRuleIds: string[];
  hasOpenFlag: boolean;
};

export type CaseDetail = CaseListItem & {
  events: {
    id: string;
    kind: EventKind;
    occurredAt: string;
    payload: unknown;
  }[];
  evaluations: {
    rulePackVersion: string;
    firedRuleIds: string[];
    tier: Tier;
    evaluatedAt: string;
  }[];
  tier1?: { body: string; createdAt: string };
  facts: CaseFacts;
  recommendation: {
    proposedOutcome: string;
    dataTaken: string;
    treatAs: string;
    text: string;
    authorName: string;
  } | null;
  decisions: {
    approverRole: string;
    approverName: string;
    outcome: string;
    notifyBy: string | null;
    reasonCode: string;
  }[];
  gate: GateState;
  clocks: ClockState[];
  conflicts: Conflict[];
  materialityRecorded: boolean;
  openFlagCount: number;
};

async function allow(actor: Actor | null, action: Action): Promise<void> {
  const auth = authorize(actor, action);
  if (auth.ok) return;
  await logRefusal(actor, action, auth.reason);
  throw new Forbidden(auth.reason);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function listItems(onlyId?: string): Promise<CaseListItem[]> {
  const rows = await db
    .select()
    .from(cases)
    .where(onlyId ? eq(cases.id, onlyId) : undefined)
    .orderBy(cases.ref);
  const evals = await db
    .select()
    .from(ruleEvaluations)
    .orderBy(desc(ruleEvaluations.evaluatedAt));
  const flags = await db
    .select({ caseId: challengeFlags.caseId })
    .from(challengeFlags)
    .where(eq(challengeFlags.status, "open"));
  const openFlagCases = new Set(flags.map((f) => f.caseId));
  return rows.map((c) => ({
    id: c.id,
    ref: c.ref,
    tier: c.tier,
    status: c.status,
    source: c.source,
    detectedAt: c.detectedAt.toISOString(),
    // Newest evaluation first, so the first match is the current one.
    firedRuleIds: evals.find((e) => e.caseId === c.id)?.firedRuleIds ?? [],
    hasOpenFlag: openFlagCases.has(c.id),
  }));
}

export async function listCases(actor: Actor | null): Promise<CaseListItem[]> {
  await allow(actor, "viewCases");
  return listItems();
}

export async function getCaseDetail(
  actor: Actor | null,
  id: string,
): Promise<CaseDetail> {
  await allow(actor, "viewCase");
  if (!UUID.test(id)) throw new NotFound();
  const [item] = await listItems(id);
  if (!item) throw new NotFound();
  const events = await db
    .select()
    .from(intakeEvents)
    .where(eq(intakeEvents.caseId, id))
    .orderBy(intakeEvents.occurredAt);
  const evaluations = await db
    .select()
    .from(ruleEvaluations)
    .where(eq(ruleEvaluations.caseId, id))
    .orderBy(ruleEvaluations.evaluatedAt);
  const [t1] = await db
    .select()
    .from(boardItems)
    .where(and(eq(boardItems.caseId, id), eq(boardItems.reasonKey, "tier1")));
  const [c] = await db.select().from(cases).where(eq(cases.id, id));
  const pack = loadRulePack("v1");
  const openFlags = await db
    .select({ id: challengeFlags.id })
    .from(challengeFlags)
    .where(
      and(eq(challengeFlags.caseId, id), eq(challengeFlags.status, "open")),
    );
  const facts = deriveFacts(events, {
    pack,
    openChallengeFlag: openFlags.length > 0,
  });
  const [rec] = await db
    .select({ r: recommendations, authorName: users.displayName })
    .from(recommendations)
    .innerJoin(users, eq(users.id, recommendations.authorId))
    .where(eq(recommendations.caseId, id));
  const decisionRows = await db
    .select({ d: decisions, approverName: users.displayName })
    .from(decisions)
    .innerJoin(users, eq(users.id, decisions.approverId))
    .where(eq(decisions.caseId, id));
  const gateInput: Decision[] = decisionRows.map(({ d }) => ({
    approverId: d.approverId,
    approverRole: d.approverRole as "GC" | "PCO",
    outcome: d.outcome,
    notifyBy: d.notifyBy?.toISOString().slice(0, 10) ?? null,
    reasonCode: d.reasonCode as Decision["reasonCode"],
  }));
  const clocks = computeClocks(
    {
      detectedAt: c!.detectedAt.toISOString(),
      highSince: c!.highSince?.toISOString() ?? null,
      materialityDeterminedAt:
        c!.materialityDeterminedAt?.toISOString() ?? null,
      closedAt: c!.closedAt?.toISOString() ?? null,
      tier: c!.tier,
    },
    pack,
    await getNow(db),
  );
  return {
    ...item,
    events: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      occurredAt: e.occurredAt.toISOString(),
      payload: e.payload,
    })),
    evaluations: evaluations.map((e) => ({
      rulePackVersion: e.rulePackVersion,
      firedRuleIds: e.firedRuleIds,
      tier: e.tier,
      evaluatedAt: e.evaluatedAt.toISOString(),
    })),
    // board_items has no timestamp; Tier 1 is created in the same transaction as high_since.
    facts,
    recommendation: rec
      ? {
          proposedOutcome: rec.r.proposedOutcome,
          dataTaken: rec.r.dataTaken,
          treatAs: rec.r.treatAs,
          text: rec.r.text,
          authorName: rec.authorName,
        }
      : null,
    decisions: decisionRows.map(({ d, approverName }) => ({
      approverRole: d.approverRole,
      approverName,
      outcome: d.outcome,
      notifyBy: d.notifyBy?.toISOString().slice(0, 10) ?? null,
      reasonCode: d.reasonCode,
    })),
    gate: gateState(gateInput),
    clocks,
    conflicts: detectConflicts(rec?.r ?? null, facts, item.firedRuleIds),
    materialityRecorded: c!.materialityDeterminedAt !== null,
    openFlagCount: openFlags.length,
    ...(t1 && c?.highSince
      ? { tier1: { body: t1.body, createdAt: c.highSince.toISOString() } }
      : {}),
  };
}
