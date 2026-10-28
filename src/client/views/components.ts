// Ported from the mockup's "small components" and "progress tracker" sections.
import { dayOf, fmtDur, fmtT } from "@/domain/demo-time";
import { ROLES } from "@/domain/roles";
import type { CaseView, NoticeView, PaymentView } from "@/domain/view-state";
import { CHK, CRS, esc } from "../html";
import { S } from "../store";

export const TRIAGE = "Needs triage";
const independent = (c: CaseView) => c.route === "INDEPENDENT";

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

export function caseTable(list: CaseView[]): string {
  if (!list.length) return '<p class="muted">No cases yet.</p>';
  return (
    '<div class="scroll"><table class="tbl"><thead><tr><th>Case</th><th>Title</th><th>Risk</th><th>Status</th><th>Waiting on</th><th>Next deadline</th></tr></thead><tbody>' +
    list
      .slice()
      .sort(
        (a, b) =>
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
          "</td></tr>",
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

type Stage = {
  k?: "auto";
  label: string;
  who: string;
  state: string;
  note?: string;
  dual?: boolean;
  votes?: { k: "gc" | "cpo"; v: string | null }[];
};

export function stages(c: CaseView): Stage[] {
  const t1 = S.d.notices.find((n) => n.caseId === c.id && n.tier === 1);
  const d = c.decision;
  const doneOut = [
    "Disclosed",
    "Disclosure limited",
    "Disclosure required",
  ].includes(c.status);
  const find = S.d.ledger.find(
    (e) => e.caseId === c.id && e.action === "Finding recorded",
  );
  const recE = S.d.ledger.find(
    (e) => e.caseId === c.id && e.action === "Recommendation sent",
  );
  const independent = c.route === "INDEPENDENT";
  const st: Stage[] = [
    {
      k: "auto",
      label: "Case opened",
      who: "System",
      state: "done",
      note: dayOf(c.detectedH) + ", automatic",
    },
    {
      k: "auto",
      label: "Board notified",
      who: "System",
      state: t1 ? "done" : "todo",
      note: t1 ? dayOf(t1.t) + ", automatic" : "",
    },
    // Staff reports that went to triage: the CPO confirms the rating before anyone investigates.
    ...(c.triageDueH !== null
      ? [
          {
            label: "Triage",
            who: "CPO",
            state: c.status === TRIAGE ? "todo" : "done",
            note: c.status === TRIAGE ? "Rates it HIGH or LOW" : "Rated",
          },
        ]
      : []),
    // A concern about how an incident is handled skips Security entirely.
    ...(independent
      ? [
          {
            label: "Investigate",
            who: "Security team",
            state: "skip",
            note: "Not Security",
          },
          {
            label: "Recommend",
            who: "CSO",
            state: "skip",
            note: "Not Security",
          },
        ]
      : [
          {
            label: "Investigate",
            who: "Security team",
            state: c.finding ? "done" : c.rec ? "skip" : "todo",
            note: find ? dayOf(find.t) : c.rec ? "Skipped" : "",
          },
          {
            label: "Recommend",
            who: "CSO",
            state: c.rec ? "done" : "todo",
            note: recE ? dayOf(recE.t) : "",
          },
        ]),
    {
      label: "Approve",
      who: independent || (d && d.need === 1) ? "GC or CPO" : "GC + CPO",
      dual: !independent && (!d || d.need === 2),
      state: !d
        ? "todo"
        : d.status === "Approved"
          ? "done"
          : d.status === "Rejected"
            ? "fail"
            : "todo",
      votes: (["gc", "cpo"] as const).map((k) => ({
        k,
        v: d?.votes[k]?.vote ?? null,
      })),
    },
    {
      label: "Outcome",
      who: c.status === "Disclosure required" ? "General Counsel" : "",
      state:
        c.status === "Disclosure required"
          ? "todo"
          : doneOut
            ? c.status === "Disclosure limited"
              ? "warn"
              : "done"
            : "todo",
      note: doneOut ? c.status : "",
    },
  ];
  const i = st.findIndex((x) => x.state === "todo");
  if (i > -1) st[i]!.state = "now";
  return st;
}

export function waitingOn(c: CaseView): string {
  if (c.status === TRIAGE) return "Chief Privacy Officer (rating)";
  if (c.status === "Awaiting review") return "Security team (review)";
  if (c.severity !== "HIGH")
    return '<span class="muted">Nothing pending</span>';
  const n = stages(c).find((x) => x.state === "now");
  if (!n) return '<span class="muted">Done</span>';
  if (n.label === "Approve") {
    const d = c.decision;
    if (!d && independent(c)) return "General Counsel or Chief Privacy Officer";
    return (["gc", "cpo"] as const)
      .filter((k) => !d?.votes[k])
      .map((k) => ROLES[k].name)
      .join(" + ");
  }
  if (n.label === "Outcome" && c.status === "Disclosure required")
    return "General Counsel (to disclose)";
  return n.who || "Decision";
}

export function tracker(c: CaseView): string {
  const st = stages(c),
    me = S.role;
  const icon = (x: Stage) =>
    x.state === "done"
      ? CHK
      : x.state === "fail"
        ? CRS
        : x.state === "warn"
          ? "!"
          : x.state === "skip"
            ? "–"
            : "";
  const mine = (x: Stage) =>
    (x.who === "Security team" && me === "security") ||
    (x.who === "CSO" && me === "cso") ||
    (x.label === "Approve" && (me === "gc" || me === "cpo")) ||
    (x.label === "Triage" && me === "cpo") ||
    (x.label === "Board notified" && me === "board");
  return (
    '<div class="tracker scroll" role="list" aria-label="Case progress">' +
    st
      .map((x, i) => {
        let body =
          '<div class="tk-dot">' +
          icon(x) +
          '</div><div class="tk-text"><b>' +
          x.label +
          "</b><span>" +
          x.who +
          "</span>";
        if (x.votes) {
          const need =
            x.who === "GC or CPO" ? "1 approval needed" : "Both must approve";
          body +=
            '<span class="tk-need">' +
            need +
            '</span><div class="tk-votes">' +
            x.votes
              .map(
                (v) =>
                  '<span class="tk-vote ' +
                  (v.v === "approve" ? "yes" : v.v === "reject" ? "no" : "") +
                  '">' +
                  (v.v === "approve"
                    ? CHK
                    : v.v === "reject"
                      ? CRS
                      : "<i></i>") +
                  (v.k === "gc" ? "GC" : "CPO") +
                  "</span>",
              )
              .join("") +
            "</div>";
        } else if (x.note)
          body += '<span class="tk-note">' + x.note + "</span>";
        body += "</div>";
        const prev = st[i - 1];
        const you = mine(x) && x.state === "now";
        return (
          (prev
            ? '<div class="tk-line ' +
              (prev.state === "done" || prev.state === "skip" ? "on" : "") +
              '"></div>'
            : "") +
          '<div role="listitem" class="tk ' +
          x.state +
          (x.dual ? " dual" : "") +
          (x.k === "auto" ? " auto" : "") +
          (you ? " you" : "") +
          '">' +
          body +
          (you ? '<em class="tk-you">You</em>' : "") +
          "</div>"
        );
      })
      .join("") +
    "</div>"
  );
}

export const rag = (level: string, label: string): string =>
  '<span class="rag ' + level + '"><i></i>' + label + "</span>";

export const miniTrack = (c: CaseView): string =>
  '<span class="mini">' +
  stages(c)
    .map((x) => '<i class="' + x.state + '" title="' + x.label + '"></i>')
    .join("") +
  "</span>";

export function discStatus(c: CaseView): string {
  if (c.status === "Disclosed")
    return rag("g", "Disclosed " + dayOf(c.disclosedH ?? 0));
  if (c.status === "Disclosure limited")
    return rag("r", "Withheld by approvers");
  if (c.status === "Disclosure required")
    return rag("a", "Required, not yet done");
  return rag("n", "Not decided");
}

export const ico = (l: string): string =>
  '<span class="ico ' +
  l +
  '">' +
  (l === "g" ? CHK : l === "r" ? CRS : l === "a" ? "!" : "–") +
  "</span>";

export const stat = (l: string, t: string): string =>
  '<span class="stat ' + l + '">' + t + "</span>";
