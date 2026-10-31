// Decisions (General Counsel, Chief Privacy Officer).
import { S } from "../store";
import { caseTable } from "./components";

export function vApprovals(): string {
  const role = S.role as "gc" | "cpo";
  return (
    '<div class="pagehead"><div><h1>Decisions</h1><p class="lede">Limiting disclosure needs you and the ' +
    (role === "gc" ? "Chief Privacy Officer" : "General Counsel") +
    ".</p></div></div>" +
    '<section class="panel"><h2>Handled independently of Security</h2><p class="muted small">Concerns about how an incident is handled. Security cannot see these.</p>' +
    caseTable(
      S.d.cases.filter((c) => c.route === "INDEPENDENT"),
      { action: true },
    ) +
    "</section>" +
    '<section class="panel"><h2>Cases</h2><p class="muted small">High-risk cases' +
    (role === "cpo" ? " and staff reports waiting for your rating" : "") +
    ".</p>" +
    caseTable(
      S.d.cases.filter(
        (c) =>
          c.route !== "INDEPENDENT" &&
          (c.severity === "HIGH" || c.status === "Needs triage"),
      ),
      { action: true },
    ) +
    "</section>"
  );
}
