import { gdprRemaining, type Clock } from "./clocks";

export type EscalationInput = {
  now: number;
  notices: {
    id: string;
    caseId: string;
    tier: 1 | 2;
    kind: string;
    t: number;
    ack: number | null;
    allDirectors: boolean;
  }[];
  cases: {
    id: string;
    severity: string;
    status: string;
    clocks: Clock[];
    route: string;
    triageDueH: number | null;
    reviewDueH: number | null;
    finding: string | null;
  }[];
  flags: { id: string; caseId: string; open: boolean; t: number }[];
};

export type Escalations = {
  /** Tier 2 notices unread for 24 hours: send to all directors. */
  toAllDirectors: string[];
  /** New Tier 2 notices to send. */
  notices: { caseId: string; kind: string; body: string }[];
  /** Staff reports still unrated 24 hours after they arrived: rated HIGH automatically. */
  triageTimeouts: string[];
};

export const TRIAGE_STATUS = "Needs triage";
export const REVIEW_LATE_BODY = "Low-risk staff report not reviewed in time";

/** The mockup's checkEscalations(), as a pure function of state and time. */
export function dueEscalations(s: EscalationInput): Escalations {
  const toAllDirectors = s.notices
    .filter(
      (n) =>
        n.tier === 2 && n.ack === null && !n.allDirectors && s.now - n.t >= 24,
    )
    .map((n) => n.id);
  const sent = new Set(s.notices.map((n) => n.caseId + "|" + n.kind));
  const notices: Escalations["notices"] = [];
  for (const c of s.cases) {
    if (c.severity !== "HIGH" || c.status === "Disclosed") continue;
    const rem = gdprRemaining(c.clocks, s.now);
    if (rem !== null && rem < 72 * 0.25 && !sent.has(c.id + "|deadline"))
      notices.push({
        caseId: c.id,
        kind: "deadline",
        body:
          "GDPR 72-hour deadline on " +
          c.id +
          " " +
          (rem < 0 ? "has passed" : "is close") +
          " and disclosure is not approved.",
      });
  }
  const triageTimeouts = s.cases
    .filter(
      (c) =>
        c.status === TRIAGE_STATUS &&
        c.triageDueH !== null &&
        s.now >= c.triageDueH,
    )
    .map((c) => c.id);
  for (const c of s.cases) {
    const late =
      c.route === "SECURITY_TRIAGE" &&
      c.severity === "LOW" &&
      !c.finding &&
      c.reviewDueH !== null &&
      s.now >= c.reviewDueH;
    if (late && !sent.has(c.id + "|review"))
      notices.push({
        caseId: c.id,
        kind: "review",
        body: REVIEW_LATE_BODY + ".",
      });
  }
  for (const f of s.flags) {
    const kind = "flag:" + f.id;
    if (f.open && s.now - f.t >= 24 && !sent.has(f.caseId + "|" + kind))
      notices.push({
        caseId: f.caseId,
        kind,
        body: "Staff challenge on " + f.caseId + " unresolved for 24 hours.",
      });
  }
  return { toAllDirectors, notices, triageTimeouts };
}
