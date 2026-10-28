import type { PaymentStatus, Severity } from "./types";

/** A payment linked to an open HIGH case starts Held. No decision ever approves a payment. */
export function initialPaymentStatus(severity: Severity): PaymentStatus {
  return severity === "HIGH" ? "Held" : "Approved for release";
}

export type ReleaseResult =
  { ok: true } | { ok: false; reason: string } | { ok: false; noop: true };

/** Finance may release a payment unless it is held on a high-risk case (mockup: A.release). */
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
        ", an open high-risk case. Payments on high-risk cases stay frozen; no decision on the case releases them.",
    };
  return { ok: false, noop: true };
}
