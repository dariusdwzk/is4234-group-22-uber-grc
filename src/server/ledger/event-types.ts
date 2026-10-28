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
  "Out-of-band contact attached",
  "Incident declared",
  "Incident reported",
  "Challenge raised",
  "Recommendation sent",
  "Conflicts detected",
  "Approved",
  "Rejected",
  "Approved by both approvers",
  "Disclosure approved",
  "Payment held",
  "Payment hold lifted",
  "Payment cancelled",
  "Payment released",
] as const;

/** A refused action is itself evidence: "Blocked: <what was tried>". */
export type BlockedEventType = `Blocked: ${string}`;

export type LedgerEventType =
  (typeof LEDGER_EVENT_TYPES)[number] | BlockedEventType;
