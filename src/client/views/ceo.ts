// CEO overview: read-only.
import { S } from "../store";
import { caseTable, noticeRow } from "./components";

export function vCeo(): string {
  return (
    '<div class="pagehead"><div><h1>Overview</h1><p class="lede">You can see everything. You cannot approve or close cases.</p></div></div>' +
    '<section class="panel"><h2>High-risk cases</h2>' +
    caseTable(S.d.cases.filter((c) => c.severity === "HIGH")) +
    "</section>" +
    '<section class="panel"><h2>What the board has been told</h2>' +
    (S.d.notices.length
      ? S.d.notices
          .slice()
          .reverse()
          .map((n) => noticeRow(n, false))
          .join("")
      : '<p class="muted">Nothing yet.</p>') +
    "</section>"
  );
}
