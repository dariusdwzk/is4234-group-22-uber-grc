// Decisions (General Counsel, Chief Privacy Officer).
import { esc } from "../html";
import { S } from "../store";
import { caseTable } from "./components";

export function vApprovals(): string {
  const role = S.role as "gc" | "cpo";
  const pend = S.d.cases.filter(
    (c) =>
      c.decision && c.decision.status === "Pending" && !c.decision.votes[role],
  );
  return (
    '<div class="pagehead"><div><h1>Decisions</h1><p class="lede">Limiting disclosure needs you and the ' +
    (role === "gc" ? "Chief Privacy Officer" : "General Counsel") +
    ".</p></div></div>" +
    '<section class="panel"><h2>Waiting for you</h2>' +
    (pend.length
      ? '<ul class="list">' +
        pend
          .map(
            (c) =>
              '<li><span class="grow"><b>' +
              c.id +
              "</b> " +
              esc(c.decision!.type) +
              '</span><button class="btn primary sm" data-a="openCase" data-x="' +
              c.id +
              '">Review</button></li>',
          )
          .join("") +
        "</ul>"
      : '<p class="muted">Nothing waiting.</p>') +
    "</section>" +
    triageList(role) +
    '<section class="panel"><h2>Handled independently of Security</h2><p class="muted small">Concerns about how an incident is handled. Security cannot see these.</p>' +
    caseTable(S.d.cases.filter((c) => c.route === "INDEPENDENT")) +
    "</section>" +
    '<section class="panel"><h2>High-risk cases</h2>' +
    caseTable(
      S.d.cases.filter(
        (c) => c.severity === "HIGH" && c.route !== "INDEPENDENT",
      ),
    ) +
    "</section>"
  );
}

/** The CPO rates staff reports the reporter was unsure about. */
function triageList(role: "gc" | "cpo"): string {
  const list = S.d.cases.filter((c) => c.status === "Needs triage");
  if (role !== "cpo" || !list.length) return "";
  return (
    '<section class="panel"><h2>Staff reports to rate</h2>' +
    caseTable(list) +
    "</section>"
  );
}
