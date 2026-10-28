import type { PaymentStatus, Severity } from "./types";

/** A payment linked to an open HIGH case starts Held unless limiting was already approved. */
export function initialPaymentStatus(
  severity: Severity,
  limitApproved: boolean,
): PaymentStatus {
  return severity === "HIGH" && !limitApproved
    ? "Held"
    : "Approved for release";
}

export type ReleaseResult =
  { ok: true } | { ok: false; reason: string } | { ok: false; noop: true };

/** Finance may release only after both approvals lifted the hold (mockup: A.release). */
export function canRelease(p: {
  status: PaymentStatus;
  caseId: string;
}): ReleaseResult {
  if (p.status === "Approved for release") return { ok: true };
  if (p.status === "Held")
    return {
      ok: false,
      reason:
        "Linked to " +
        p.caseId +
        ", an open high-risk case. Needs approval from the General Counsel and the Chief Privacy Officer.",
    };
  return { ok: false, noop: true };
}
