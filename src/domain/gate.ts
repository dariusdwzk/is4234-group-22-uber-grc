import { ROLES } from "./roles";

export type RecAction = "limit" | "disclose";
export type Approver = "gc" | "cpo";
export type Vote = "approve" | "reject";
export type DecisionStatus = "Pending" | "Approved" | "Rejected";

export type NewDecision = {
  type: string;
  need: 1 | 2;
  disclose: boolean;
  caseStatus: string;
};

/** Limiting disclosure needs both keys; disclosing needs one (mockup: A.rec). */
export function decisionFor(action: RecAction): NewDecision {
  return action === "limit"
    ? {
        type: "Pay as a bug bounty and limit disclosure",
        need: 2,
        disclose: false,
        caseStatus: "Awaiting 2 approvals",
      }
    : {
        type: "Notify regulators and affected people",
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
  /** Both keys approved limiting disclosure: allowed, on record, board told. */
  | { kind: "limited" }
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
  if (otherVote === "approve") return { kind: "limited" };
  const other: Approver = voter === "gc" ? "cpo" : "gc";
  return { kind: "waiting", caseStatus: "Awaiting " + ROLES[other].name };
}
