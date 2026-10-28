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
  cases: { id: string; severity: string; status: string; clocks: Clock[] }[];
  flags: { id: string; caseId: string; open: boolean; t: number }[];
};

export type Escalations = {
  /** Tier 2 notices unread for 24 hours: send to all directors. */
  toAllDirectors: string[];
  /** New Tier 2 notices to send. */
  notices: { caseId: string; kind: string; body: string }[];
};

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
  for (const f of s.flags) {
    const kind = "flag:" + f.id;
    if (f.open && s.now - f.t >= 24 && !sent.has(f.caseId + "|" + kind))
      notices.push({
        caseId: f.caseId,
        kind,
        body: "Staff challenge on " + f.caseId + " unresolved for 24 hours.",
      });
  }
  return { toAllDirectors, notices };
}
