// The case page: header, timeline, alerts, summary, action panel, Deadlines / Activity.
import { heldPaymentText } from "@/domain/payment";
import { knownScale } from "@/domain/board-text";
import { ESCALATED_STATUS } from "@/domain/gate";
import { fmtDur, fmtT } from "@/domain/demo-time";
import { QUESTIONNAIRE } from "@/domain/questionnaire";
import type { CaseView } from "@/domain/view-state";
import { actionRequired } from "../../action-required";
import { esc } from "../../html";
import { navFor } from "../../nav";
import { S } from "../../store";
import {
  TRIAGE,
  caseTitle,
  clip,
  legal,
  remText,
  sev,
  statusBadge,
} from "../components";
import { evidencePanel, independentBox } from "./independent";
import { normalBox } from "./normal";
import { reviewBox } from "./review";
import { tracker } from "./timeline";
import { triageBox } from "./triage";

const ANSWER_TEXT = { YES: "Yes", NO: "No", NOT_SURE: "Not sure" } as const;
/** Short labels for the questionnaire's questions (full text stays in the tooltip). */
const Q_LABEL: Record<string, string> = {
  data: "Personal data",
  money: "Money",
  harm: "Harm",
  handling: "How it is handled",
  systems: "Systems affected",
  outsiders: "Outsiders aware",
  ongoing: "Still happening",
};

/** Signal titles the server cut: staff reports at 60 characters (after "Anonymous: "), emails at 80. */
const sigTitle = (s: { src: string; title: string }): string =>
  s.src === "Staff report"
    ? clip(s.title, (s.title.startsWith("Anonymous: ") ? 11 : 0) + 60)
    : s.src === "Email to CSO"
      ? clip(s.title, 80)
      : s.title;

/** The reporter's answers, in the questionnaire's order. */
export function answersList(c: CaseView): string {
  if (!c.answers) return "";
  const a = c.answers;
  return (
    '<h3 style="margin-top:14px">Reporter’s answers</h3><div class="qanswers">' +
    QUESTIONNAIRE.questions
      .map(
        (q) =>
          '<span title="' +
          esc(q.text) +
          '"><span class="muted">' +
          (Q_LABEL[q.id] ?? q.id) +
          ":</span> " +
          ANSWER_TEXT[a[q.id]] +
          "</span>",
      )
      .join("") +
    "</div>"
  );
}

/** The action panel depends on where the case is in its route. */
function actionBox(c: CaseView): string {
  if (c.status === TRIAGE) return triageBox(c);
  if (c.severity === "LOW" && c.route === "SECURITY_TRIAGE")
    return reviewBox(c);
  if (c.severity === "LOW")
    return '<section class="panel" id="actionbox"><h2>No action needed</h2><p class="muted" style="margin:0">Low risk. Logged without approval. Sampled periodically.</p></section>';
  if (c.route === "INDEPENDENT") return independentBox(c);
  return normalBox(c);
}

function caseSummary(c: CaseView): string {
  const f = c.facts,
    sigs = c.signals
      .map((id) => S.d.signals.find((s) => s.id === id))
      .filter((s) => !!s),
    fired = c.rules.filter((x) => x.fired);
  const t1 = S.d.notices.find((n) => n.caseId === c.id && n.tier === 1);
  const g = c.clocks.find((k) => k.key === "gdpr");
  const kv: [string, string][] = [];
  if (f.dataAccessed)
    kv.push([
      "Data exposed",
      knownScale(f)
        ? "About " +
          f.records +
          " records" +
          (f.licences
            ? ", incl. " + f.licences + " driver licence numbers"
            : "")
        : "Reported by staff; scale not yet known",
    ]);
  if (c.route === "INDEPENDENT")
    kv.push([
      "Handled by",
      "General Counsel and Chief Privacy Officer, not Security",
    ]);
  if (f.jurisdictions.length)
    kv.push(["Affected residents", f.jurisdictions.join(", ")]);
  const pay = heldPaymentText(f);
  if (pay) kv.push([c.severity === "HIGH" ? "Payment held" : "Payment", pay]);
  if (c.severity === "HIGH") kv.push(["Regulator", "FTC inquiry open"]);
  if (t1) kv.push(["Board", "Notified " + fmtT(t1.t)]);
  if (g && g.start !== null && g.dur !== null && c.status !== "Disclosed")
    kv.push(["GDPR deadline", legal(remText(g.start + g.dur - S.d.clockH))]);
  const unrated = c.severity === "PENDING";
  return (
    '<section class="panel summary"><div class="cols2"><div><h2>Case summary</h2>' +
    (kv.length
      ? '<dl class="kv" style="margin-top:0">' +
        kv
          .map(
            ([k, v]) =>
              // The held payment stands out: approvers should see it before deciding.
              (k === "Payment held" ? '<dt class="kv-hold">' : "<dt>") +
              k +
              (k === "Payment held"
                ? '</dt><dd class="kv-hold">'
                : "</dt><dd>") +
              (k === "GDPR deadline" ? v : esc(v)) +
              "</dd>",
          )
          .join("") +
        "</dl>"
      : '<p class="muted">' +
        (unrated
          ? "Impact not yet confirmed — the Chief Privacy Officer rates this report."
          : "No personal data involved.") +
        "</p>") +
    '<h3 style="margin-top:14px">Signals</h3><ul class="list">' +
    sigs
      .map(
        (s) =>
          '<li><span class="muted small" style="width:8.5rem;flex:none">' +
          fmtT(s.h) +
          '</span><span class="grow">' +
          esc(sigTitle(s)) +
          ' <span class="badge ' +
          (s.origin === "system" ? "sys" : "warn") +
          '">' +
          esc(s.src) +
          (s.origin === "system" ? ", automatic" : ", manual") +
          "</span></span></li>",
      )
      .join("") +
    "</ul>" +
    answersList(c) +
    "</div>" +
    "<div><h2>" +
    (fired.length
      ? "Why it is high risk"
      : unrated
        ? "Not yet rated"
        : "Why it is low risk") +
    "</h2>" +
    (fired.length
      ? fired
          .map(
            (x) =>
              '<div class="rule-fired"><span class="rid">' +
              x.id +
              "</span><span>" +
              x.name +
              '<div class="muted small">' +
              esc(x.ev) +
              "</div></span></div>",
          )
          .join("")
      : '<p class="muted">' +
        (unrated
          ? "The rules run again once the rating is confirmed."
          : "No high-risk rule fired.") +
        "</p>") +
    "</div></div></section>"
  );
}

export function vCase(): string {
  const c = S.d.cases.find((x) => x.id === S.caseId);
  if (S.role === "employee") return "<p>This page is not available.</p>";
  if (!c) return "<p>Case not found.</p>";
  const items = navFor(S.role!, S),
    from = items.find((i) => i.current) ?? items[0]!;
  const o =
    '<nav aria-label="Breadcrumb"><button class="link" data-a="' +
    from.a +
    '" data-x="' +
    from.x +
    '">' +
    from.label +
    "</button> / " +
    c.id +
    "</nav>" +
    '<div class="case-head"><span class="cid">' +
    c.id +
    "</span><h1>" +
    esc(caseTitle(c)) +
    "</h1>" +
    sev(c) +
    '<span class="badge">' +
    statusBadge(c) +
    "</span></div>";
  let main = "";
  if (
    c.severity === "HIGH" ||
    c.status === TRIAGE ||
    c.route === "SECURITY_TRIAGE"
  )
    main += tracker(c);
  if (c.status === ESCALATED_STATUS)
    main +=
      '<div class="alert warn"><b>Escalated internally by both approvers</b>Disclosure has not been made and the deadlines keep running. The decision and every step before it are permanently on record.</div>';
  main += caseSummary(c) + evidencePanel(c);
  const tabs = (
    [
      ["deadlines", "Deadlines"],
      ["log", "Activity"],
    ] as const
  ).filter((t) => t[0] !== "deadlines" || c.clocks.length);
  if (!tabs.some((t) => t[0] === S.caseTab)) S.caseTab = tabs[0]![0];
  main +=
    '<div class="tabs">' +
    tabs
      .map(
        (t) =>
          '<button class="tab ' +
          (S.caseTab === t[0] ? "on" : "") +
          '" data-a="caseTab" data-x="' +
          t[0] +
          '">' +
          t[1] +
          "</button>",
      )
      .join("") +
    "</div>";
  if (S.caseTab === "deadlines") {
    main +=
      '<section class="panel"><div class="scroll"><table class="tbl"><tbody>' +
      c.clocks
        .map((k) => {
          let st: string;
          if (k.met) st = '<span class="t-ok">Met</span>';
          else if (c.status === "Disclosed" && k.start !== null)
            st = '<span class="t-ok">Met</span>';
          else if (k.start === null)
            st = '<span class="muted">Not started: ' + k.note + "</span>";
          else if (k.dur === null)
            st =
              legal(fmtDur(S.d.clockH - k.start) + " elapsed") +
              ' <span class="muted">(' +
              k.note +
              ")</span>";
          else if (k.key === "class" || k.key === "mat")
            st = remText(k.start + k.dur - S.d.clockH);
          else st = legal(remText(k.start + k.dur - S.d.clockH));
          return "<tr><td>" + k.name + "</td><td>" + st + "</td></tr>";
        })
        .join("") +
      "</tbody></table></div></section>";
  } else {
    const es = S.d.ledger
      .filter((e) => e.caseId === c.id)
      .slice()
      .reverse();
    main +=
      '<section class="panel"><ol class="tl">' +
      es
        .map(
          (e) =>
            '<li class="' +
            (e.action.startsWith("Blocked")
              ? "blk"
              : e.actor === "System"
                ? "sys"
                : "") +
            '"><b>' +
            esc(e.action) +
            '</b> <span class="muted">by ' +
            esc(e.actor) +
            ", " +
            fmtT(e.t) +
            '</span><div class="muted small">' +
            esc(e.detail) +
            "</div></li>",
        )
        .join("") +
      "</ol></section>";
  }
  const needs = actionRequired(c, S.role);
  return (
    o +
    '<div class="case-grid"><div class="case-main">' +
    main +
    '</div><aside class="case-aside' +
    (needs ? " needs" : "") +
    '" aria-label="Your action"><div class="eyebrow' +
    (needs ? '">Waiting on you' : ' muted">Status') +
    "</div>" +
    actionBox(c) +
    "</aside></div>"
  );
}
