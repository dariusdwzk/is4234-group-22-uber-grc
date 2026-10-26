import type { CaseFacts } from "./facts";

export type Conflict = {
  code: "DATA_TAKEN_CONTRADICTED" | "BOUNTY_LABEL_CONTRADICTED";
  message: string;
};

/** Where the security recommendation disagrees with the evidence (US-14). */
export function detectConflicts(
  rec: { dataTaken: string; treatAs: string } | null,
  facts: CaseFacts,
  firedRuleIds: readonly string[],
): Conflict[] {
  if (!rec) return [];
  const out: Conflict[] = [];
  if (rec.dataTaken === "no" && facts.personalDataAccessed)
    out.push({
      code: "DATA_TAKEN_CONTRADICTED",
      message:
        "Recommendation says no data was taken, but the evidence shows personal data was accessed.",
    });
  if (rec.treatAs === "bug_bounty" && firedRuleIds.includes("R-PAY-LINKED"))
    out.push({
      code: "BOUNTY_LABEL_CONTRADICTED",
      message:
        "Recommendation says treat as bug bounty, but the payment is linked to an incident whatever its label.",
    });
  return out;
}
