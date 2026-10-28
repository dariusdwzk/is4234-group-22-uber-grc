// The case timeline (mockup: stages(), waitingOn(), tracker()).
import { dayOf } from "@/domain/demo-time";
import { ROLES } from "@/domain/roles";
import type { CaseView } from "@/domain/view-state";
import { CHK, CRS } from "../../html";
import { S } from "../../store";
import { TRIAGE } from "../components";

const independent = (c: CaseView) => c.route === "INDEPENDENT";

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

export const miniTrack = (c: CaseView): string =>
  '<span class="mini">' +
  stages(c)
    .map((x) => '<i class="' + x.state + '" title="' + x.label + '"></i>')
    .join("") +
  "</span>";
