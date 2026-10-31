// Ported from the mockup's "small components" and "progress tracker" sections.
import { dayOf, fmtDur, fmtT } from "@/domain/demo-time";
import type { CaseView, NoticeView, PaymentView } from "@/domain/view-state";
import { CHK, esc } from "../html";
import { ESCALATED_STATUS } from "@/domain/gate";
import { actionRequired, yesNo } from "../action-required";
import { S } from "../store";
import { waitingOn } from "./case/timeline";

export const TRIAGE = "Needs triage";

export const sev = (c: CaseView): string =>
  c.severity === "PENDING"
    ? '<span class="badge warn">Not rated</span>'
    : '<span class="badge ' +
      (c.severity === "HIGH" ? "high" : "") +
      '">' +
      c.severity +
      "</span>";

/** Case status; a staff report waiting for triage shows amber. */
export const statusBadge = (c: CaseView): string =>
  c.status === TRIAGE
    ? '<span class="badge warn">Needs triage</span>'
    : esc(c.status);

export function remText(r: number): string {
  return r < 0
    ? '<span class="t-high">Overdue ' + fmtDur(-r) + "</span>"
    : r < 18
      ? '<span class="t-warn">' + fmtDur(r) + " left</span>"
      : fmtDur(r) + " left";
}

function nearest(c: CaseView): string {
  if (c.status === "Disclosed") return '<span class="t-ok">Met</span>';
  if (c.status === TRIAGE && c.triageDueH !== null)
    return (
      remText(c.triageDueH - S.d.clockH) +
      ' <span class="muted small">then HIGH automatically</span>'
    );
  if (c.status === "Awaiting review" && c.reviewDueH !== null)
    return (
      remText(c.reviewDueH - S.d.clockH) +
      ' <span class="muted small">to review</span>'
    );
  const r = c.clocks
    .filter((k) => k.dur && !k.met && k.start !== null)
    .map((k) => k.start! + k.dur! - S.d.clockH);
  return r.length ? remText(Math.min(...r)) : '<span class="muted">None</span>';
}

export const payBadge = (p: PaymentView): string =>
  '<span class="badge ' +
  (p.status === "Held"
    ? "warn"
    : p.status === "Approved for release"
      ? "ok"
      : "") +
  '">' +
  p.status +
  "</span>";

/** Cases, high-risk first. With `action`, adds "Action required" for the signed-in role and lists those first. */
export function caseTable(
  list: CaseView[],
  opts: { action?: boolean } = {},
): string {
  if (!list.length) return '<p class="muted">No cases yet.</p>';
  const needs = (c: CaseView) =>
    opts.action === true && actionRequired(c, S.role);
  return (
    '<div class="scroll"><table class="tbl"><thead><tr><th>Case</th><th>Title</th><th>Risk</th><th>Status</th><th>Waiting on</th><th>Next deadline</th>' +
    (opts.action ? "<th>Action required</th>" : "") +
    "</tr></thead><tbody>" +
    list
      .slice()
      .sort(
        (a, b) =>
          Number(needs(b)) - Number(needs(a)) ||
          Number(b.severity === "HIGH") - Number(a.severity === "HIGH") ||
          b.id.localeCompare(a.id),
      )
      .map(
        (c) =>
          '<tr class="clickrow" data-a="openCase" data-x="' +
          c.id +
          '"><td><b>' +
          c.id +
          "</b></td><td>" +
          esc(c.title) +
          (c.id === S.d.replayId && !S.seenReplay
            ? ' <span class="badge sys">New</span>'
            : "") +
          "</td><td>" +
          sev(c) +
          "</td><td>" +
          statusBadge(c) +
          "</td><td>" +
          waitingOn(c) +
          "</td><td>" +
          nearest(c) +
          "</td>" +
          (opts.action ? "<td>" + yesNo(needs(c)) + "</td>" : "") +
          "</tr>",
      )
      .join("") +
    "</tbody></table></div>"
  );
}

export function noticeRow(n: NoticeView, canAck: boolean): string {
  const ackE =
    n.ack !== null
      ? '<span class="ack-ok">' +
        CHK +
        " Acknowledged " +
        dayOf(n.ack) +
        "</span>"
      : canAck
        ? '<button class="btn sm primary" data-a="ack" data-x="' +
          n.id +
          '">Acknowledge</button>'
        : '<span class="badge warn">Not acknowledged</span>';
  return (
    '<div class="notice"><span class="badge ' +
    (n.tier === 2 ? "high" : "") +
    '">' +
    (n.tier === 1 ? "For information" : "Needs board attention") +
    '</span><div class="grow">' +
    esc(n.body) +
    '<div class="muted small">' +
    dayOf(n.t) +
    ", " +
    fmtT(n.t) +
    (n.allDirs
      ? ' <span class="badge high">Sent to all directors</span>'
      : "") +
    "</div></div>" +
    ackE +
    "</div>"
  );
}

export const rag = (level: string, label: string): string =>
  '<span class="rag ' + level + '"><i></i>' + label + "</span>";

export function discStatus(c: CaseView): string {
  if (c.status === "Disclosed")
    return rag("g", "Disclosed " + dayOf(c.disclosedH ?? 0));
  if (c.status === ESCALATED_STATUS)
    return rag("a", "Investigating internally");
  if (c.status === "Disclosure required")
    return rag("a", "Required, not yet done");
  return rag("n", "Not decided");
}
