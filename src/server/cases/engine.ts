import "server-only";
import { eq, isNotNull, like } from "drizzle-orm";
import { tier1Body } from "@/domain/board-text";
import { INDEPENDENT_REASON, canAccessCase } from "@/domain/case-access";
import { clocksFrom } from "@/domain/clocks";
import { matchCase } from "@/domain/correlation";
import { addBusinessDays } from "@/domain/demo-time";
import { dueEscalations } from "@/domain/escalations";
import { QUESTIONNAIRE } from "@/domain/questionnaire";
import { evaluate, firedIds, startsClocks } from "@/domain/rules";
import { defaultFacts, type Facts, type SignalOrigin } from "@/domain/types";
import type { DbClient, Tx } from "../db/client";
import {
  boardNotices,
  cases,
  challengeFlags,
  settings,
  signals,
} from "../db/schema";
import { Forbidden, NotFound } from "../errors";
import { anchorHead } from "../ledger/anchor";
import type { CommandCtx } from "../run-command";

export type CaseRow = typeof cases.$inferSelect;

/** Next "PREFIX-n" id: one more than the highest number in use (ids are never reused). */
export async function nextId(
  tx: Tx,
  table:
    typeof cases | typeof signals | typeof boardNotices | typeof challengeFlags,
  prefix: string,
  floor: number,
): Promise<string> {
  const rows = await tx
    .select({ id: table.id })
    .from(table)
    .where(like(table.id, prefix + "-%"));
  const max = Math.max(
    floor,
    ...rows.map((r) => Number(r.id.slice(prefix.length + 1)) || 0),
  );
  return prefix + "-" + (max + 1);
}

export async function getCase(tx: DbClient, id: string): Promise<CaseRow> {
  const [c] = await tx.select().from(cases).where(eq(cases.id, id));
  if (!c) throw new NotFound("No case “" + id + "”.");
  return c;
}

/** getCase for a command: Security never acts on a case routed away from it. */
export async function getCaseFor(
  ctx: CommandCtx,
  id: string,
): Promise<CaseRow> {
  const c = await getCase(ctx.tx, id);
  if (!canAccessCase(ctx.actor.role, c.route))
    throw new Forbidden(INDEPENDENT_REASON, { caseId: id });
  return c;
}

/** Re-rating only ever raises a case: no later signal or flag can quietly lower it. */
export const raised = (
  was: CaseRow["severity"],
  now: "LOW" | "HIGH",
): CaseRow["severity"] => (was === "LOW" ? now : was);

/** A staff report becomes a HIGH case on the normal path (after triage or a timeout). */
export async function rateHigh(tx: Tx, caseId: string): Promise<void> {
  await tx
    .update(cases)
    .set({ severity: "HIGH", route: "NORMAL", status: "Open" })
    .where(eq(cases.id, caseId));
}

/** A LOW staff report: Security must review it within the configured business days. */
export async function rateLow(
  tx: Tx,
  caseId: string,
  now: number,
): Promise<void> {
  await tx
    .update(cases)
    .set({
      severity: "LOW",
      route: "SECURITY_TRIAGE",
      status: "Awaiting review",
      reviewDueH: addBusinessDays(now, QUESTIONNAIRE.reviewBusinessDays),
    })
    .where(eq(cases.id, caseId));
}

export async function regulatorInquiryOpen(tx: Tx): Promise<boolean> {
  const [s] = await tx.select().from(settings).where(eq(settings.id, 1));
  return s?.regulatorInquiryOpen ?? true;
}

/** Sends a board notice in the same transaction and anchors the ledger head (mockup: notice()). */
export async function sendNotice(
  ctx: CommandCtx,
  caseId: string,
  tier: 1 | 2,
  kind: string,
  body?: string,
): Promise<void> {
  const { tx, now, log } = ctx;
  let text = body;
  if (tier === 1) {
    const c = await getCase(tx, caseId);
    text = tier1Body(
      c,
      await regulatorInquiryOpen(tx),
      c.clocksStartH !== null,
    );
  }
  if (text === undefined) throw new Error("Tier 2 notices need a body");
  const id = await nextId(tx, boardNotices, "N", 0);
  await tx
    .insert(boardNotices)
    .values({ id, caseId, tier, kind, body: text, createdH: now });
  await log(
    tier === 1 ? "Board notice sent (Tier 1)" : "Board notice sent (Tier 2)",
    caseId,
    text,
    { actor: "System" },
  );
  await anchorHead(tx, now, "After board notice");
}

/** First rating of a new case (mockup: classify()). */
async function classify(ctx: CommandCtx, caseId: string): Promise<void> {
  const { tx, log } = ctx;
  const c = await getCase(tx, caseId);
  const e = evaluate(c.facts, await regulatorInquiryOpen(tx));
  const sys = { actor: "System" };
  if (e.severity === "HIGH") {
    await log(
      "Classified HIGH",
      c.id,
      "Rules fired: " + firedIds(e) + ".",
      sys,
    );
    const clocks = startsClocks(c.facts);
    await tx
      .update(cases)
      .set({
        severity: "HIGH",
        status: "Open",
        clocksStartH: clocks ? c.detectedH : null,
      })
      .where(eq(cases.id, c.id));
    if (clocks)
      await log(
        "Deadlines started",
        c.id,
        "GDPR and internal clocks running.",
        sys,
      );
    await sendNotice(ctx, c.id, 1, "t1");
  } else {
    await tx
      .update(cases)
      .set({ severity: "LOW", status: "Logged" })
      .where(eq(cases.id, c.id));
    await log("Classified LOW", c.id, "Logged without approval.", sys);
  }
}

export type SignalIn = {
  source: string;
  origin: SignalOrigin;
  detectedH: number;
  title: string;
  entityKeys: string[];
  facts?: Partial<Facts>;
  anonymous?: boolean;
};

export async function insertSignal(
  tx: Tx,
  s: SignalIn,
  caseId: string | null = null,
): Promise<string> {
  const id = await nextId(tx, signals, "SIG", 200);
  await tx.insert(signals).values({
    id,
    source: s.source,
    origin: s.origin,
    detectedH: s.detectedH,
    title: s.title,
    entityKeys: s.entityKeys,
    facts: s.facts ?? {},
    caseId,
    anonymous: s.anonymous ?? false,
  });
  return id;
}

/** Merges a signal's facts into a case and re-rates it (mockup: addToCase()). */
export async function addToCase(
  ctx: CommandCtx,
  caseId: string,
  signalId: string,
  why: string,
): Promise<void> {
  const { tx, log } = ctx;
  const c = await getCase(tx, caseId);
  const [sig] = await tx.select().from(signals).where(eq(signals.id, signalId));
  if (!sig) throw new NotFound("No signal " + signalId);
  await tx.update(signals).set({ caseId }).where(eq(signals.id, signalId));

  const open = await regulatorInquiryOpen(tx);
  const before = firedIds(evaluate(c.facts, open));
  const facts: Facts = { ...c.facts, ...sig.facts };
  const e = evaluate(facts, open);
  const becameHigh = c.severity === "LOW" && e.severity === "HIGH";
  await tx
    .update(cases)
    .set({
      facts,
      severity: raised(c.severity, e.severity),
      ...(becameHigh ? { status: "Open" } : {}),
    })
    .where(eq(cases.id, caseId));

  const sys = { actor: "System" };
  await log("Signal merged", caseId, signalId + " " + why, sys);
  if (firedIds(e) !== before)
    await log(
      "Rules re-evaluated",
      caseId,
      "Now fired: " + firedIds(e) + ".",
      sys,
    );
  if (becameHigh) await sendNotice(ctx, caseId, 1, "t1");
}

/**
 * A stored signal is routed (mockup: ingest()): it joins the open case that shares an entity
 * key, or opens a new case by itself and is classified. Returns the case id.
 */
export async function ingest(
  ctx: CommandCtx,
  signalId: string,
  caseTitle?: string,
): Promise<string> {
  const { tx, log } = ctx;
  const [s] = await tx.select().from(signals).where(eq(signals.id, signalId));
  if (!s) throw new NotFound("No signal " + signalId);

  const linked = await tx
    .select({
      caseId: signals.caseId,
      keys: signals.entityKeys,
      status: cases.status,
    })
    .from(signals)
    .innerJoin(cases, eq(cases.id, signals.caseId))
    .where(isNotNull(signals.caseId))
    .orderBy(cases.id, signals.id);
  const byCase = new Map<
    string,
    { id: string; status: string; entityKeys: string[] }
  >();
  for (const r of linked) {
    const entry = byCase.get(r.caseId!) ?? {
      id: r.caseId!,
      status: r.status,
      entityKeys: [],
    };
    entry.entityKeys.push(...r.keys);
    byCase.set(r.caseId!, entry);
  }
  const match = matchCase(s.entityKeys, [...byCase.values()]);
  if (match) {
    await addToCase(
      ctx,
      match.caseId,
      signalId,
      "shares “" + match.key + "” with this case.",
    );
    return match.caseId;
  }

  const id = await nextId(tx, cases, "C", 100);
  await tx.insert(cases).values({
    id,
    title: caseTitle ?? s.title,
    severity: "LOW",
    status: "",
    detectedH: s.detectedH,
    facts: { ...defaultFacts(), ...s.facts },
  });
  await tx.update(signals).set({ caseId: id }).where(eq(signals.id, signalId));
  await log(
    "Case opened automatically",
    id,
    "From " + signalId + ". No one had to declare it.",
    { actor: "System" },
  );
  await classify(ctx, id);
  return id;
}

/** The mockup's checkEscalations(): run whenever time moves or a decision is taken. */
export async function runEscalations(ctx: CommandCtx): Promise<void> {
  const { tx, now, log } = ctx;
  // One connection per transaction: queries run one after another, never in parallel.
  const notices = await tx.select().from(boardNotices);
  const allCases = await tx.select().from(cases);
  const flags = await tx.select().from(challengeFlags);
  const due = dueEscalations({
    now,
    notices: notices.map((n) => ({
      id: n.id,
      caseId: n.caseId,
      tier: n.tier,
      kind: n.kind,
      t: n.createdH,
      ack: n.ackH,
      allDirectors: n.allDirectors,
    })),
    cases: allCases.map((c) => ({
      id: c.id,
      severity: c.severity,
      status: c.status,
      clocks: clocksFrom(c.clocksStartH),
      route: c.route,
      triageDueH: c.triageDueH,
      reviewDueH: c.reviewDueH,
      finding: c.finding,
    })),
    flags: flags.map((f) => ({
      id: f.id,
      caseId: f.caseId,
      open: f.open,
      t: f.createdH,
    })),
  });
  for (const id of due.toAllDirectors) {
    const n = notices.find((x) => x.id === id)!;
    await tx
      .update(boardNotices)
      .set({ allDirectors: true })
      .where(eq(boardNotices.id, id));
    await log(
      "Notice escalated to all directors",
      n.caseId,
      id + " not acknowledged within 24 hours.",
      { actor: "System" },
    );
  }
  for (const id of due.triageTimeouts) {
    await rateHigh(tx, id);
    await log(
      "Triage timed out: rated HIGH automatically",
      id,
      "No rating within " + QUESTIONNAIRE.triageHours + " hours of the report.",
      { actor: "System" },
    );
    await sendNotice(ctx, id, 1, "t1");
  }
  for (const n of due.notices)
    await sendNotice(ctx, n.caseId, 2, n.kind, n.body);
}
