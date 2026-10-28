// Ported from the mockup's "small components" and "progress tracker" sections.
import { dayOf, fmtDur, fmtT } from "@/domain/demo-time";
import { ROLES } from "@/domain/roles";
import type { CaseView, NoticeView, PaymentView } from "@/domain/view-state";
import { CHK, CRS, esc } from "../html";
import { S } from "../store";

export const sev = (c: CaseView): string =>
  '<span class="badge ' +
  (c.severity === "HIGH" ? "high" : "") +
  '">' +
  c.severity +
  "</span>";

export function remText(r: number): string {
  return r < 0
    ? '<span class="t-high">Overdue ' + fmtDur(-r) + "</span>"
    : r < 18
      ? '<span class="t-warn">' + fmtDur(r) + " left</span>"
      : fmtDur(r) + " left";
}

function nearest(c: CaseView): string {
  if (c.status === "Disclosed") return '<span class="t-ok">Met</span>';
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
          esc(c.status) +
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
    {
      label: "Approve",
      who: d && d.need === 1 ? "GC or CPO" : "GC + CPO",
      dual: !d || d.need === 2,
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
  if (c.severity !== "HIGH")
    return '<span class="muted">Nothing pending</span>';
  const n = stages(c).find((x) => x.state === "now");
  if (!n) return '<span class="muted">Done</span>';
  if (n.label === "Approve") {
    const d = c.decision;
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
