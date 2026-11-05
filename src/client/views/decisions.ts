// Decisions (General Counsel, Chief Privacy Officer).
import { S } from "../store";
import { approvalsCases } from "../nav";
import { caseTable } from "./components";

export function vApprovals(): string {
  const role = S.role as "gc" | "cpo";
  const { independent, other } = approvalsCases(S.d.cases);
  return (
    '<div class="pagehead"><div><h1>All cases</h1><p class="lede">High-risk cases, staff reports and cases handled without Security.</p></div></div>' +
    '<section class="panel"><h2>Handled independently of Security</h2><p class="muted small">Concerns about how an incident is handled. Security cannot see these.</p>' +
    caseTable(independent, { action: true }) +
    "</section>" +
    '<section class="panel"><h2>Cases</h2><p class="muted small">High-risk cases' +
    (role === "cpo" ? " and staff reports waiting for your rating" : "") +
    ".</p>" +
    caseTable(other, { action: true }) +
    "</section>"
  );
}
