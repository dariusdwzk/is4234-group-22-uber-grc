import "server-only";

// The mockup's ledger actions, verbatim: the board's evidence log turns them into sentences.
export const LEDGER_EVENT_TYPES = [
  "GENESIS",
  "Signal received",
  "Signal merged",
  "Case opened automatically",
  "Classified HIGH",
  "Classified LOW",
  "Rules re-evaluated",
  "Deadlines started",
  "Board notice sent (Tier 1)",
  "Board notice sent (Tier 2)",
  "Notice acknowledged",
  "Notice escalated to all directors",
  "Finding recorded",
  "Evidence added",
  "Out-of-band contact attached",
  "Incident declared",
  "Staff report received",
  "Rated HIGH from questionnaire",
  "Rated LOW from questionnaire",
  "Sent for triage: reporter unsure about impact",
  "Routed away from Security: concern about how an incident is handled",
  "Triage rating confirmed by Chief Privacy Officer: HIGH",
  "Triage rating confirmed by Chief Privacy Officer: LOW",
  "Triage timed out: rated HIGH automatically",
  "Challenge raised",
  "Recommendation sent",
  "Approved",
  "Rejected",
  "Approved by both approvers",
  "Disclosure approved",
  "Payment held",
  "Payment cancelled",
  "Payment released",
] as const;

/** A refused action is itself evidence: "Blocked: <what was tried>". */
export type BlockedEventType = `Blocked: ${string}`;

export type LedgerEventType =
  (typeof LEDGER_EVENT_TYPES)[number] | BlockedEventType;
