import type { Actor, Outcome } from "./types";

export type ReasonCode =
  | "LEGAL_ADVICE"
  | "REGULATORY_DEADLINE"
  | "CONTAINMENT_CONFIRMED"
  | "INSUFFICIENT_EVIDENCE"
  | "LAW_ENFORCEMENT_REQUEST"
  | "OTHER";

export const REASON_CODES: readonly ReasonCode[] = [
  "LEGAL_ADVICE",
  "REGULATORY_DEADLINE",
  "CONTAINMENT_CONFIRMED",
  "INSUFFICIENT_EVIDENCE",
  "LAW_ENFORCEMENT_REQUEST",
  "OTHER",
];

type GateRole = "GC" | "PCO";
const GATE_ROLES: readonly GateRole[] = ["GC", "PCO"];

export type Decision = {
  approverId: string;
  approverRole: GateRole;
  outcome: Outcome;
  notifyBy: string | null;
  reasonCode: ReasonCode;
};

export type Checklist = {
  reviewedEvidence: boolean;
  noPersonalConflict: boolean;
  consideredRegulatorDeadlines: boolean;
  consideredBoardNotice: boolean;
  notInstructedBySecurity: boolean;
};

export type GateState =
  | { status: "awaiting"; missing: GateRole[] }
  | { status: "agreed"; outcome: Outcome; notifyBy: string | null }
  | { status: "disagreement" };

/** Two keys: GC and PCO. A later entry for the same role replaces the earlier one. */
export function gateState(decisions: readonly Decision[]): GateState {
  const byRole = new Map<GateRole, Decision>();
  for (const x of decisions) byRole.set(x.approverRole, x);
  const missing = GATE_ROLES.filter((r) => !byRole.has(r));
  if (missing.length > 0) return { status: "awaiting", missing };
  const [a, b] = GATE_ROLES.map((r) => byRole.get(r)!) as [Decision, Decision];
  const sameDate = a.outcome !== "notify_later" || a.notifyBy === b.notifyBy;
  if (a.outcome !== b.outcome || !sameDate) return { status: "disagreement" };
  return {
    status: "agreed",
    outcome: a.outcome,
    notifyBy: a.outcome === "notify_later" ? a.notifyBy : null,
  };
}

export type DecisionRefusal =
  | "WRONG_ROLE"
  | "NOT_INDEPENDENT"
  | "SAME_APPROVER"
  | "CHECKLIST_INCOMPLETE"
  | "NOTIFY_DATE_REQUIRED";

export function checkDecision(input: {
  approver: Actor;
  independent: boolean;
  checklist: Checklist;
  outcome: Outcome;
  notifyBy: string | null;
  existing: readonly Decision[];
}): { ok: true } | { ok: false; reason: DecisionRefusal } {
  const { approver } = input;
  if (approver.role !== "GC" && approver.role !== "PCO")
    return { ok: false, reason: "WRONG_ROLE" };
  if (!input.independent) return { ok: false, reason: "NOT_INDEPENDENT" };
  if (
    input.existing.some(
      (x) => x.approverRole !== approver.role && x.approverId === approver.id,
    )
  )
    return { ok: false, reason: "SAME_APPROVER" };
  if (!Object.values(input.checklist).every((v) => v === true))
    return { ok: false, reason: "CHECKLIST_INCOMPLETE" };
  if (input.outcome === "notify_later" && !input.notifyBy)
    return { ok: false, reason: "NOTIFY_DATE_REQUIRED" };
  return { ok: true };
}
