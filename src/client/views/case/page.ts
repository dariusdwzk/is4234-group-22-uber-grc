// The case page: header, timeline, alerts, summary, action panel, Deadlines / Activity.
import { knownScale } from "@/domain/board-text";
import { ESCALATED_STATUS } from "@/domain/gate";
import { dayOf, fmtDur } from "@/domain/demo-time";
import { money } from "@/domain/money";
import { QUESTIONNAIRE } from "@/domain/questionnaire";
import type { CaseView } from "@/domain/view-state";
import { esc } from "../../html";
import { S } from "../../store";
import { TRIAGE, payBadge, remText, sev, statusBadge } from "../components";
import { evidencePanel, independentBox } from "./independent";
import { normalBox } from "./normal";
import { reviewBox } from "./review";
import { tracker } from "./timeline";
import { triageBox } from "./triage";

const ANSWER_TEXT = { YES: "Yes", NO: "No", NOT_SURE: "Not sure" } as const;

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
          q.id +
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
  const p = S.d.payments.find((x) => x.caseId === c.id),
    t1 = S.d.notices.find((n) => n.caseId === c.id && n.tier === 1);
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
  if (p)
    kv.push([
      "Payment",
      money(p.amountCents) + " to " + esc(p.payee) + " " + payBadge(p),
    ]);
  if (c.severity === "HIGH") kv.push(["Regulator", "FTC inquiry open"]);
  if (t1) kv.push(["Board", "Notified " + dayOf(t1.t)]);
  if (g && g.start !== null && g.dur !== null && c.status !== "Disclosed")
    kv.push(["GDPR deadline", remText(g.start + g.dur - S.d.clockH)]);
  return (
    '<section class="panel summary"><div class="cols2"><div><h2>Case summary</h2>' +
    (kv.length
      ? '<dl class="kv" style="margin-top:0">' +
        kv
          .map(
            ([k, v]) =>
              "<dt>" +
              k +
              "</dt><dd>" +
              (k === "Payment" || k === "GDPR deadline" ? v : esc(v)) +
              "</dd>",
          )
          .join("") +
        "</dl>"
      : '<p class="muted">No personal data involved.</p>') +
    '<h3 style="margin-top:14px">Signals</h3><ul class="list">' +
    sigs
      .map(
        (s) =>
          '<li><span class="muted small" style="width:3.4rem;flex:none">' +
          dayOf(s.h) +
          '</span><span class="grow">' +
          esc(s.title) +
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
    (fired.length ? "Why it is high risk" : "Why it is low risk") +
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
      : '<p class="muted">No high-risk rule fired.</p>') +
    "</div></div></section>"
  );
}

export function vCase(): string {
  const c = S.d.cases.find((x) => x.id === S.caseId);
  if (S.role === "employee") return "<p>Employees cannot open cases.</p>";
  if (!c) return "<p>Case not found.</p>";
  let o =
    '<button class="link" data-a="home">← Back</button>' +
    '<div class="case-head"><span class="cid">' +
    c.id +
    "</span><h1>" +
    esc(c.title) +
    "</h1>" +
    sev(c) +
    '<span class="badge">' +
    statusBadge(c) +
    "</span></div>";
  if (c.severity === "HIGH" || c.status === TRIAGE) o += tracker(c);
  if (S.lastBlock)
    o +=
      '<div class="alert high"><b>Not allowed: ' +
      esc(S.lastBlock.what) +
      "</b>" +
      esc(S.lastBlock.why) +
      " This attempt has been logged.</div>";
  if (c.status === ESCALATED_STATUS)
    o +=
      '<div class="alert warn"><b>Escalated internally by both approvers</b>Disclosure has not been made and the deadlines keep running. The decision and every step before it are permanently on record.</div>';
  o += caseSummary(c) + actionBox(c) + evidencePanel(c);
  const tabs = (
    [
      ["deadlines", "Deadlines"],
      ["log", "Activity"],
    ] as const
  ).filter((t) => t[0] !== "deadlines" || c.clocks.length);
  if (!tabs.some((t) => t[0] === S.caseTab)) S.caseTab = tabs[0]![0];
  o +=
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
    o +=
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
              fmtDur(S.d.clockH - k.start) +
              ' elapsed <span class="muted">(' +
              k.note +
              ")</span>";
          else st = remText(k.start + k.dur - S.d.clockH);
          return "<tr><td>" + k.name + "</td><td>" + st + "</td></tr>";
        })
        .join("") +
      "</tbody></table></div></section>";
  } else {
    const es = S.d.ledger
      .filter((e) => e.caseId === c.id)
      .slice()
      .reverse();
    o +=
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
            dayOf(e.t) +
            '</span><div class="muted small">' +
            esc(e.detail) +
            "</div></li>",
        )
        .join("") +
      "</ol></section>";
  }
  return o;
}
