// Whether a case needs something from the signed-in role right now ("Action required").
import type { RoleKey } from "@/domain/types";
import type { CaseView } from "@/domain/view-state";

const TRIAGE = "Needs triage";

export function actionRequired(c: CaseView, role: RoleKey | null): boolean {
  const independent = c.route === "INDEPENDENT";
  const lowReport = c.route === "SECURITY_TRIAGE" && c.severity === "LOW";
  switch (role) {
    case "security":
      // A finding on a HIGH case, facts on a triage case, or the review of a LOW report.
      if (c.status === TRIAGE || lowReport) return !c.finding;
      return c.severity === "HIGH" && !independent && !c.finding && !c.rec;
    case "cso":
      return c.severity === "HIGH" && !independent && !c.rec;
    case "gc":
    case "cpo": {
      if (role === "cpo" && c.status === TRIAGE) return true;
      if (c.status === "Disclosure required") return true;
      if (independent && !c.rec) return true; // one of them investigates and recommends
      const d = c.decision;
      if (!d || d.status !== "Pending" || d.votes[role]) return false;
      return !(independent && c.rec?.author === role); // never your own recommendation
    }
    default:
      return false;
  }
}

export const yesNo = (yes: boolean): string =>
  yes ? '<span class="badge high">Yes</span>' : '<span class="muted">No</span>';
