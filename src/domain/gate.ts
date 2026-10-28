import { ROLES } from "./roles";

export type RecAction = "escalate" | "disclose";
export type Approver = "gc" | "cpo";
export type Vote = "approve" | "reject";
export type DecisionStatus = "Pending" | "Approved" | "Rejected";

export const ESCALATE_TYPE = "Escalate internally for further investigation";
export const DISCLOSE_TYPE = "Notify regulators and affected people";
/** Both keys agreed to investigate further before disclosing. Clocks keep running. */
export const ESCALATED_STATUS = "Under internal investigation";

export type NewDecision = {
  type: string;
  need: 1 | 2;
  disclose: boolean;
  caseStatus: string;
};

/** The approver who is not `role`. */
export const otherApprover = (role: Approver): Approver =>
  role === "gc" ? "cpo" : "gc";

const typeFor = (action: RecAction) =>
  action === "escalate" ? ESCALATE_TYPE : DISCLOSE_TYPE;

/**
 * Independent path: one of GC / CPO recommends, and the recommendation is their key.
 * The other one must decide, so no one approves their own recommendation.
 */
export function independentDecisionFor(
  action: RecAction,
  author: Approver,
): NewDecision {
  return {
    type: typeFor(action),
    need: 1,
    disclose: action === "disclose",
    caseStatus: "Awaiting " + ROLES[otherApprover(author)].name,
  };
}

/** Anything short of disclosure needs both keys; disclosing needs one (mockup: A.rec). */
export function decisionFor(action: RecAction): NewDecision {
  return action === "escalate"
    ? {
        type: typeFor(action),
        need: 2,
        disclose: false,
        caseStatus: "Awaiting 2 approvals",
      }
    : {
        type: typeFor(action),
        need: 1,
        disclose: true,
        caseStatus: "Awaiting decision",
      };
}

export type VoteOutcome =
  /** Any rejection: disclosure required, held payment cancelled, board told. */
  | { kind: "rejected" }
  /** A disclose decision approved by one key. */
  | { kind: "disclosed" }
  /** Both keys agreed to escalate internally: no payment approved, board told, clocks run on. */
  | { kind: "escalated" }
  | { kind: "waiting"; caseStatus: string };

/** What a vote does, given the decision and the other approver's vote (mockup: A.vote). */
export function voteOutcome(
  decision: { disclose: boolean },
  voter: Approver,
  vote: Vote,
  otherVote: Vote | null,
): VoteOutcome {
  if (vote === "reject") return { kind: "rejected" };
  if (decision.disclose) return { kind: "disclosed" };
  if (otherVote === "approve") return { kind: "escalated" };
  const other: Approver = voter === "gc" ? "cpo" : "gc";
  return { kind: "waiting", caseStatus: "Awaiting " + ROLES[other].name };
}
