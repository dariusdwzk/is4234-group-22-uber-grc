// The case timeline (mockup: stages(), waitingOn(), tracker()). Each route has its own steps;
// tracker() draws whichever list the case's route produces, in the mockup's style.
import { dayOf } from "@/domain/demo-time";
import { otherApprover, type Approver } from "@/domain/gate";
import { ROLES } from "@/domain/roles";
import type { RoleKey } from "@/domain/types";
import type { CaseView } from "@/domain/view-state";
import { CHK, CRS } from "../../html";
import { S } from "../../store";
import { TRIAGE } from "../components";

type Stage = {
  k?: "auto";
  label: string;
  who: string;
  state: string;
  note?: string;
  dual?: boolean;
  /** Text under an approval stage, e.g. "Both must approve". */
  need?: string;
  votes?: { k: Approver; v: string | null }[];
  /** Roles that act at this step (for the "You" marker). */
  roles?: RoleKey[];
};

const OUTCOMES = ["Disclosed", "Disclosure limited", "Disclosure required"];
const short = (r: Approver) => (r === "gc" ? "GC" : "CPO");
const entry = (c: CaseView, action: string) =>
  S.d.ledger.find((e) => e.caseId === c.id && e.action === action);

/** Case opened (or report received) and the automatic board notice: every route starts here. */
function opening(c: CaseView): Stage[] {
  const t1 = S.d.notices.find((n) => n.caseId === c.id && n.tier === 1);
  return [
    {
      k: "auto",
      label: c.answers ? "Report received" : "Case opened",
      who: c.answers ? "Employee" : "System",
      state: "done",
      note: dayOf(c.detectedH) + (c.answers ? ", staff report" : ", automatic"),
    },
    {
      k: "auto",
      label: "Board notified",
      who: "System",
      state: t1 ? "done" : "todo",
      note: t1 ? dayOf(t1.t) + ", automatic" : "",
      roles: ["board"],
    },
  ];
}

/** Staff reports the reporter was unsure about: the CPO rates them first. */
function triage(c: CaseView): Stage[] {
  if (c.triageDueH === null) return [];
  const pending = c.status === TRIAGE;
  return [
    {
      label: "Triage",
      who: "CPO",
      state: pending ? "todo" : "done",
      note: pending ? "Rates it HIGH or LOW" : "Rated",
      roles: ["cpo"],
    },
  ];
}

function outcome(c: CaseView, who: string): Stage {
  const out = OUTCOMES.includes(c.status);
  return {
    label: "Outcome",
    who: c.status === "Disclosure required" ? who : "",
    state:
      c.status === "Disclosure required"
        ? "todo"
        : out
          ? c.status === "Disclosure limited"
            ? "warn"
            : "done"
          : "todo",
    note: out ? c.status : "",
  };
}

function approveState(c: CaseView): string {
  const d = c.decision;
  if (!d) return "todo";
  return d.status === "Approved"
    ? "done"
    : d.status === "Rejected"
      ? "fail"
      : "todo";
}

/** The demo flow: Security investigates, the CSO recommends, GC + CPO approve. */
function normalStages(c: CaseView): Stage[] {
  const d = c.decision;
  const find = entry(c, "Finding recorded"),
    recE = entry(c, "Recommendation sent");
  const one = !!d && d.need === 1;
  return [
    {
      label: "Investigate",
      who: "Security team",
      state: c.finding ? "done" : c.rec ? "skip" : "todo",
      note: find ? dayOf(find.t) : c.rec ? "Skipped" : "",
      roles: ["security"],
    },
    {
      label: "Recommend",
      who: "CSO",
      state: c.rec ? "done" : "todo",
      note: recE ? dayOf(recE.t) : "",
      roles: ["cso"],
    },
    {
      label: "Approve",
      who: one ? "GC or CPO" : "GC + CPO",
      dual: !one,
      need: one ? "1 approval needed" : "Both must approve",
      state: approveState(c),
      votes: (["gc", "cpo"] as const).map((k) => ({
        k,
        v: d?.votes[k]?.vote ?? null,
      })),
      roles: ["gc", "cpo"],
    },
    outcome(c, "General Counsel"),
  ];
}

/**
 * A concern about how an incident is handled: Security is skipped. The GC or CPO investigates
 * and recommends; the other one approves, so nobody decides their own recommendation.
 */
function independentStages(c: CaseView): Stage[] {
  const d = c.decision;
  const author = c.rec?.author as Approver | undefined;
  const first = c.evidence[0];
  const investigator = first
    ? ROLES[first.author].name
    : (entry(c, "Finding recorded")?.actor ?? "GC or CPO");
  const investigated = !!c.finding || c.evidence.length > 0;
  const n = c.evidence.length;
  const approver = author ? otherApprover(author) : undefined;
  return [
    {
      label: "Investigate",
      who: investigator,
      state: investigated ? "done" : c.rec ? "skip" : "todo",
      note: investigated
        ? n + " evidence note" + (n === 1 ? "" : "s")
        : c.rec
          ? "Skipped"
          : "Findings and evidence",
      roles: ["gc", "cpo"],
    },
    {
      label: "Recommend",
      who: author ? ROLES[author].name : "GC or CPO",
      state: c.rec ? "done" : "todo",
      note: c.rec ? dayOf(c.rec.t) : "",
      roles: ["gc", "cpo"],
    },
    {
      label: "Approve",
      who: approver ? ROLES[approver].name : "The other one",
      dual: true,
      need: "The other one must approve",
      state: approveState(c),
      // The recommendation is the author's key; the other approver's vote is the second.
      votes:
        author && approver
          ? [
              { k: author, v: "approve" },
              { k: approver, v: d?.votes[approver]?.vote ?? null },
            ]
          : undefined,
      roles: approver ? [approver] : ["gc", "cpo"],
    },
    outcome(c, "General Counsel or CPO"),
  ];
}

export function stages(c: CaseView): Stage[] {
  const body =
    c.route === "INDEPENDENT" ? independentStages(c) : normalStages(c);
  const st = [...opening(c), ...triage(c), ...body];
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
  if (c.route === "INDEPENDENT") {
    if (n.label === "Investigate" || n.label === "Recommend")
      return "General Counsel or Chief Privacy Officer";
    if (n.label === "Approve") return n.who;
  }
  if (n.label === "Approve") {
    const d = c.decision;
    return (["gc", "cpo"] as const)
      .filter((k) => !d?.votes[k])
      .map((k) => ROLES[k].name)
      .join(" + ");
  }
  if (n.label === "Outcome" && c.status === "Disclosure required")
    return n.who + " (to disclose)";
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
  const mine = (x: Stage) => me !== null && !!x.roles?.includes(me);
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
        if (x.need) {
          body +=
            '<span class="tk-need">' +
            x.need +
            "</span>" +
            (x.votes
              ? '<div class="tk-votes">' +
                x.votes
                  .map(
                    (v) =>
                      '<span class="tk-vote ' +
                      (v.v === "approve"
                        ? "yes"
                        : v.v === "reject"
                          ? "no"
                          : "") +
                      '">' +
                      (v.v === "approve"
                        ? CHK
                        : v.v === "reject"
                          ? CRS
                          : "<i></i>") +
                      short(v.k) +
                      "</span>",
                  )
                  .join("") +
                "</div>"
              : "");
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
