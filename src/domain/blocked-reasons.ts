import type { RoleKey } from "./types";

export type Attempt = "close" | "downgrade" | "approve";

export const ATTEMPT_LABELS: Record<Attempt, string> = {
  close: "Close case",
  downgrade: "Lower severity",
  approve: "Approve",
};

/** Why a case action is refused, in the mockup's words (A.blocked). */
export function blockedReason(role: RoleKey | null, what: Attempt): string {
  if (role === "ceo") return "The CEO can view cases but cannot change them.";
  if (what === "close") return "Security cannot close cases.";
  if (what === "downgrade") return "Security cannot lower severity.";
  if (role === "cso")
    return "Your reporting line is Security. The legal title does not make you an independent approver.";
  return "Approvers must be outside Security.";
}
