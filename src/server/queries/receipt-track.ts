import "server-only";
import { defaultFacts } from "@/domain/types";
import type { CaseView, ReceiptTrack } from "@/domain/view-state";
import { getViewState } from "./state";

/** Ledger actions the timeline reads; only their times and actors are kept. */
const TIMELINE_ACTIONS = new Set(["Finding recorded", "Recommendation sent"]);

/**
 * The timeline of one case, for the employee holding its receipt code. Everything the
 * timeline does not draw is stripped out here, on the server.
 */
export async function receiptTrack(
  caseId: string,
): Promise<ReceiptTrack | null> {
  const all = await getViewState({ role: "board", name: "Receipt lookup" });
  const c = all.cases.find((x) => x.id === caseId);
  if (!c) return null;
  const redacted: CaseView = {
    ...c,
    facts: defaultFacts(),
    signals: [],
    rules: [],
    clocks: [],
    finding: c.finding ? "Recorded" : null,
    rec: c.rec ? { ...c.rec, reason: null } : null,
    decision: c.decision
      ? {
          ...c.decision,
          votes: Object.fromEntries(
            Object.entries(c.decision.votes).map(([k, v]) => [
              k,
              { vote: v.vote, reason: "", t: v.t },
            ]),
          ),
        }
      : null,
    evidence: c.evidence.map((e) => ({ ...e, id: 0, note: "", file: null })),
  };
  return {
    case: redacted,
    notices: all.notices
      .filter((n) => n.caseId === caseId && n.tier === 1)
      .map((n) => ({ ...n, body: "" })),
    ledger: all.ledger
      .filter((e) => e.caseId === caseId && TIMELINE_ACTIONS.has(e.action))
      .map((e) => ({ ...e, detail: "", hash: "" })),
  };
}
