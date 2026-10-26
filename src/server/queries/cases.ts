import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { Actor, CaseStatus, EventKind, Tier } from "@/domain/types";
import { authorize, type Action } from "../authz";
import { db } from "../db/client";
import {
  boardItems,
  cases,
  challengeFlags,
  intakeEvents,
  ruleEvaluations,
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
    ...(t1 && c?.highSince
      ? { tier1: { body: t1.body, createdAt: c.highSince.toISOString() } }
      : {}),
  };
}
