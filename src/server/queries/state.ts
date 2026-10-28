import "server-only";
import { asc } from "drizzle-orm";
import { clocksFrom } from "@/domain/clocks";
import { canAccessCase } from "@/domain/case-access";
import { conflicts } from "@/domain/conflicts";
import { evaluate } from "@/domain/rules";
import type { Actor } from "@/domain/types";
import type { CaseView, ViewState } from "@/domain/view-state";
import { authorize } from "../authz";
import { db } from "../db/client";
import {
  approvals,
  boardNotices,
  cases,
  challengeFlags,
  decisions,
  evidence,
  payments,
  recommendations,
  settings,
  signals,
} from "../db/schema";
import { verifyChain } from "../ledger/verify";
import { listLedger } from "./ledger";

/** Everything the current role may see (GET /api/state). Filtering happens here, never in the browser. */
export async function getViewState(actor: Actor | null): Promise<ViewState> {
  const can = (a: Parameters<typeof authorize>[1]) => authorize(actor, a).ok;
  const [s] = await db.select().from(settings);
  const [
    allCases,
    allSignals,
    recs,
    decs,
    votes,
    pays,
    notices,
    flags,
    ledger,
  ] = await Promise.all([
    db.select().from(cases).orderBy(asc(cases.id)),
    db.select().from(signals).orderBy(asc(signals.id)),
    db.select().from(recommendations),
    db.select().from(decisions),
    db.select().from(approvals),
    db.select().from(payments).orderBy(asc(payments.id)),
    db.select().from(boardNotices),
    db.select().from(challengeFlags),
    listLedger(),
  ]);
  // Without file_data: bytes are only sent by the download route.
  const evidenceRows = await db
    .select({
      id: evidence.id,
      caseId: evidence.caseId,
      authorRole: evidence.authorRole,
      note: evidence.note,
      fileName: evidence.fileName,
      fileType: evidence.fileType,
      fileSize: evidence.fileSize,
      fileSha256: evidence.fileSha256,
      createdH: evidence.createdH,
    })
    .from(evidence)
    .orderBy(asc(evidence.id));
  const regulatorOpen = s?.regulatorInquiryOpen ?? true;
  const notifyOrder = (id: string) => Number(id.slice(2));

  const caseViews: CaseView[] = allCases.map((c) => {
    const rec = recs.find((r) => r.caseId === c.id);
    const d = decs.find((x) => x.caseId === c.id);
    return {
      id: c.id,
      title: c.title,
      detectedH: c.detectedH,
      severity: c.severity,
      status: c.status,
      facts: c.facts,
      signals: allSignals.filter((x) => x.caseId === c.id).map((x) => x.id),
      rules: evaluate(c.facts, regulatorOpen).rules,
      clocks: clocksFrom(c.clocksStartH),
      finding: c.finding,
      disclosedH: c.disclosedH,
      rec: rec
        ? {
            author: rec.authorRole,
            act: rec.action,
            claims: rec.claims,
            t: rec.createdH,
          }
        : null,
      decision: d
        ? {
            type: d.type,
            need: d.need,
            disclose: d.disclose,
            status: d.status,
            votes: Object.fromEntries(
              votes
                .filter((v) => v.caseId === c.id)
                .map((v) => [
                  v.role,
                  { vote: v.vote, reason: v.reason, t: v.createdH },
                ]),
            ),
          }
        : null,
      conflicts: rec ? conflicts(rec.claims, c.facts) : [],
      route: c.route,
      triageDueH: c.triageDueH,
      reviewDueH: c.reviewDueH,
      answers: c.questionnaireAnswers,
      evidence: evidenceRows
        .filter((e) => e.caseId === c.id)
        .map((e) => ({
          id: e.id,
          author: e.authorRole,
          note: e.note,
          file:
            e.fileName && e.fileType && e.fileSize !== null && e.fileSha256
              ? {
                  name: e.fileName,
                  type: e.fileType,
                  size: e.fileSize,
                  sha256: e.fileSha256,
                }
              : null,
          t: e.createdH,
        })),
    };
  });

  const replayId = allSignals.find((x) => x.id === "SIG-201")?.caseId ?? null;
  const jumped = allSignals.some(
    (x) => x.source === "HackerOne" && x.entityKeys.includes("jdough"),
  );
  const replay = caseViews.find((c) => c.id === replayId);
  const blockedBy = (actorName: string, prefix = "Blocked") =>
    ledger.some((e) => e.action.startsWith(prefix) && e.actor === actorName);
  // Cases routed away from Security are left out for Security and the CSO, with everything on them.
  const visibleCases = can("viewCases")
    ? caseViews.filter((c) => canAccessCase(actor?.role ?? null, c.route))
    : [];
  // Only cases this role is kept away from by their route; Finance still sees every payment.
  const hidden = new Set(
    caseViews
      .filter((c) => !canAccessCase(actor?.role ?? null, c.route))
      .map((c) => c.id),
  );
  const shown = (caseId: string | null) => !caseId || !hidden.has(caseId);
  const visibleIds = new Set(visibleCases.map((c) => c.id));
  const board = can("viewBoard");
  const integrity = board ? await verifyChain() : null;

  return {
    role: actor?.role ?? null,
    demoMode: process.env.DEMO_MODE === "true",
    clockH: s?.clockH ?? 0,
    regulatorOpen,
    replayId,
    jumped,
    emailAttached: allSignals.some((x) => x.source === "Email to CSO"),
    cases: visibleCases,
    signals: can("viewCases")
      ? allSignals
          .filter((x) => shown(x.caseId))
          .map((x) => ({
            id: x.id,
            src: x.source,
            origin: x.origin,
            h: x.detectedH,
            title: x.title,
            caseId: x.caseId,
          }))
      : [],
    payments: can("viewPayments")
      ? pays
          .filter((p) => shown(p.caseId))
          .map((p) => ({
            id: p.id,
            payee: p.payee,
            amountCents: p.amountCents,
            caseId: p.caseId,
            status: p.status,
            t: p.createdH,
          }))
      : [],
    notices: can("viewNotices")
      ? notices
          .filter((n) => shown(n.caseId))
          .sort((a, b) => notifyOrder(a.id) - notifyOrder(b.id))
          .map((n) => ({
            id: n.id,
            caseId: n.caseId,
            tier: n.tier,
            kind: n.kind,
            body: n.body,
            t: n.createdH,
            ack: n.ackH,
            allDirs: n.allDirectors,
          }))
      : [],
    ledger: board ? ledger : ledger.filter((e) => visibleIds.has(e.caseId)),
    openFlags: board ? flags.filter((f) => f.open).length : 0,
    intact: integrity ? integrity.ok && integrity.anchorsOk : null,
    progress: {
      finding: !!replay?.finding,
      recommended: !!replay?.rec,
      csoBlocked: blockedBy("CSO (also Deputy GC)"),
      jumped,
      financeBlocked: ledger.some(
        (e) => e.action === "Blocked: Release payment",
      ),
      gcDone:
        !!replay?.decision &&
        (!!replay.decision.votes.gc || replay.decision.status !== "Pending"),
      cpoDone:
        !!replay?.decision &&
        (!!replay.decision.votes.cpo || replay.decision.status !== "Pending"),
      allAcked: notices.length > 0 && notices.every((n) => n.ackH !== null),
    },
  };
}
