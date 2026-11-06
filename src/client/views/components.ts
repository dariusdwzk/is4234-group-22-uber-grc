// Ported from the mockup's "small components" and "progress tracker" sections.
import { fmtDay, fmtDur, fmtT } from "@/domain/demo-time";
import type { CaseView, NoticeView } from "@/domain/view-state";
import { CHK, esc } from "../html";
import { ESCALATED_STATUS } from "@/domain/gate";
import { ROLES } from "@/domain/roles";
import { actionRequired, yesNo } from "../action-required";
import { S } from "../store";
import { nearestDeadline } from "../work";
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

/** A legal clock time: the clocks post-date 2016 and are illustrative. */
export const legal = (h: string): string => h + " (illustrative)";

/** Board notice text, with its GDPR deadline time marked illustrative. */
export const noticeText = (body: string): string =>
  body.replace(/(GDPR deadline [^.]*\d:\d\d)\./, "$1 (illustrative).");

/**
 * Text the server cut at `max` characters, ending at a word boundary with "…".
 * shortcut: assumes text exactly `max` long was cut; upgrade if the server sends the full text.
 */
export function clip(s: string, max: number): string {
  if (s.length < max) return s;
  const sp = s.lastIndexOf(" ");
  return (sp > 0 ? s.slice(0, sp) : s).replace(/[\s,.;:]+$/, "") + "…";
}

/** Case title; staff-report titles are the report text cut at 70 characters on the server. */
export const caseTitle = (c: CaseView): string =>
  c.answers ? clip(c.title, 70) : c.title;

/** One plain sentence for where the decision stands (Board, CEO, Security, CSO). */
export function outcomeText(c: CaseView): string {
  const d = c.decision;
  if (c.status === "Disclosed")
    return "Disclosure approved " + fmtT(c.disclosedH ?? 0) + ".";
  const rejecter = d
    ? (["gc", "cpo"] as const).find((k) => d.votes[k]?.vote === "reject")
    : undefined;
  if (d && (rejecter || c.status === "Disclosure required"))
    return (
      (rejecter ? "The " + ROLES[rejecter].name : "An approver") +
      " rejected the recommendation to " +
      d.type.toLowerCase() +
      ". Disclosure to regulators and affected people is now required."
    );
  if (c.status === ESCALATED_STATUS)
    return "Both approvers agreed to escalate internally. Disclosure has not been made; the legal deadlines keep running.";
  return "Waiting for the General Counsel and the Chief Privacy Officer to decide.";
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
  const n = nearestDeadline([c], S.d.clockH);
  return n ? legal(remText(n.h)) : '<span class="muted">None</span>';
}

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
          '"><td><button class="link" data-a="openCase" data-x="' +
          c.id +
          '"><b>' +
          c.id +
          "</b></button></td><td>" +
          esc(caseTitle(c)) +
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
        fmtT(n.ack) +
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
    esc(noticeText(n.body)) +
    '<div class="muted small">' +
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
    return rag("g", "Disclosed " + fmtDay(c.disclosedH ?? 0));
  if (c.status === ESCALATED_STATUS)
    return rag("a", "Investigating internally");
  if (c.status === "Disclosure required")
    return rag("a", "Required, not yet done");
  return rag("n", "Not decided");
}
