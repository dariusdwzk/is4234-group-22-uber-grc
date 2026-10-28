// Ported from the mockup's actionBox(), caseSummary() and vCase().
import { dayOf, fmtDur, fmtT } from "@/domain/demo-time";
import { money } from "@/domain/money";
import { ROLES } from "@/domain/roles";
import type { CaseView } from "@/domain/view-state";
import { esc } from "../html";
import { S } from "../store";
import { knownScale } from "@/domain/board-text";
import { QUESTIONNAIRE } from "@/domain/questionnaire";
import {
  TRIAGE,
  payBadge,
  remText,
  sev,
  statusBadge,
  tracker,
} from "./components";

const ANSWER_TEXT = { YES: "Yes", NO: "No", NOT_SURE: "Not sure" } as const;

/** A staff report waiting for its rating: Security establishes facts, only the CPO rates. */
function triageBox(c: CaseView): string {
  const left = c.triageDueH !== null ? remText(c.triageDueH - S.d.clockH) : "";
  const due =
    '<p class="muted small" style="margin:8px 0 0">Rated HIGH automatically in ' +
    left +
    " if no rating is confirmed.</p>";
  let h: string;
  if (S.role === "security") {
    h = !c.finding
      ? '<h2>Triage: establish the facts</h2><div class="form"><label>What you found<textarea id="fTxt" rows="2"></textarea></label>' +
        '<label class="chk"><input type="checkbox" id="tData"' +
        (c.facts.dataAccessed ? " checked" : "") +
        "> Personal or confidential data was involved</label>" +
        '<label class="chk"><input type="checkbox" id="tMoney"' +
        (c.facts.moneyConcern ? " checked" : "") +
        "> Money demanded, paid, moved or lost</label>" +
        '<label class="chk"><input type="checkbox" id="tHarm"' +
        (c.facts.harmConcern ? " checked" : "") +
        "> Someone could be harmed</label>" +
        '<div><button class="btn primary" data-a="finding">Add finding</button></div></div>'
      : '<h2>Finding recorded</h2><p class="muted" style="margin:0">' +
        esc(c.finding) +
        '</p><p class="muted small" style="margin:8px 0 0">Waiting for the Chief Privacy Officer to confirm the rating.</p>';
    h +=
      due +
      '<div class="caseacts"><span class="muted small">Case actions</span><button class="btn sm" data-a="triageTry">Confirm rating</button></div>';
  } else if (S.role === "cpo") {
    h =
      "<h2>Confirm rating</h2>" +
      (c.finding
        ? '<p style="margin:0 0 10px"><b>Security’s finding:</b> ' +
          esc(c.finding) +
          "</p>"
        : '<p class="muted" style="margin:0 0 10px">No finding from Security yet.</p>') +
      '<div class="form"><label>Rating<select id="tRating"><option value="HIGH">HIGH: needs the full process</option><option value="LOW">LOW: Security reviews it</option></select></label>' +
      '<label>Reason<textarea id="tReason" rows="2"></textarea></label>' +
      '<div><button class="btn primary" data-a="triage">Confirm rating</button></div></div>' +
      due;
  } else
    h =
      '<h2>Waiting for triage</h2><p class="muted" style="margin:0">The reporter was unsure about the impact. The Chief Privacy Officer confirms the rating.</p>' +
      due;
  return '<section class="panel action" id="actionbox">' + h + "</section>";
}

/** A LOW staff report: Security must review it within 3 business days. */
function reviewBox(c: CaseView): string {
  const due = c.reviewDueH !== null ? fmtT(c.reviewDueH) : "";
  let h: string;
  if (c.finding)
    h =
      '<h2>Reviewed</h2><p class="muted" style="margin:0">' +
      esc(c.finding) +
      "</p>";
  else if (S.role === "security")
    h =
      '<h2>Review this report</h2><div class="form"><label>What you checked<textarea id="fTxt" rows="2"></textarea></label><div><button class="btn primary" data-a="finding">Add finding</button></div></div>' +
      '<p class="muted small" style="margin:8px 0 0">Due ' +
      due +
      ". If it is not reviewed in time, the board is told.</p>";
  else
    h =
      '<h2>Low risk</h2><p class="muted" style="margin:0">Rated LOW from the reporter’s answers. Security reviews it by ' +
      due +
      ".</p>";
  return '<section class="panel action" id="actionbox">' + h + "</section>";
}

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

const isSec = () => S.role === "security" || S.role === "cso";
const isAppr = () => S.role === "gc" || S.role === "cpo";

function actionBox(c: CaseView): string {
  const r = S.role,
    d = c.decision;
  const act = (x: string, l: string) =>
    '<button class="btn sm" data-a="blocked" data-x="' +
    x +
    '">' +
    l +
    "</button>";
  if (c.status === TRIAGE) return triageBox(c);
  if (c.severity === "LOW" && c.route === "SECURITY_TRIAGE")
    return reviewBox(c);
  if (c.severity === "LOW")
    return '<section class="panel" id="actionbox"><h2>No action needed</h2><p class="muted" style="margin:0">Low risk. Logged without approval. Sampled periodically.</p></section>';
  let h = "";
  if (isSec()) {
    if (r === "security") {
      if (!c.finding)
        h =
          '<h2>Investigation finding</h2><div class="form"><label>What the investigation confirmed<textarea id="fTxt" rows="2">Confirmed: 16 objects copied from rider-backup using an AWS key last rotated in 2013. Includes about 600,000 driver licence numbers.</textarea></label><div><button class="btn primary" data-a="finding">Add finding</button></div></div>';
      else
        h =
          '<h2>Finding recorded</h2><p class="muted" style="margin:0">' +
          esc(c.finding) +
          "</p>" +
          (!c.rec
            ? '<p class="muted small" style="margin:8px 0 0">Waiting for the CSO’s recommendation.</p>'
            : "");
    } else if (c.id === S.d.replayId && !S.d.emailAttached)
      h =
        '<h2>Attach out-of-band contact</h2><div class="form"><label>Message received outside monitored systems<textarea id="aTxt" rows="2">Email to the CSO from an anonymous sender: “We have your rider data. We expect a six-figure payment.”</textarea></label><div><button class="btn primary" data-a="attach">Attach to case</button></div></div>';
    else if (!c.rec)
      h =
        '<h2>Recommendation</h2><div class="form"><label>Recommended action<select id="rAct"><option value="limit">Pay as a bug bounty and limit disclosure</option><option value="disclose">Notify regulators and affected people</option></select></label>' +
        '<details><summary>Claims included</summary><div class="form"><label class="chk"><input type="checkbox" id="rC1" checked> Reporter deleted the data</label><label class="chk"><input type="checkbox" id="rC2" checked> Reporter identity verified</label><label class="chk"><input type="checkbox" id="rC3" checked> Routine bug bounty</label></div></details>' +
        '<div><button class="btn primary" data-a="rec">Send for decision</button></div></div>';
    else
      h =
        '<h2>Recommendation sent</h2><p class="muted" style="margin:0">Waiting for the General Counsel and the Chief Privacy Officer.</p>';
    h +=
      '<div class="caseacts"><span class="muted small">Case actions</span>' +
      act("close", "Close case") +
      act("downgrade", "Lower severity") +
      (r === "cso" ? act("approve", "Approve") : "") +
      "</div>";
  } else if (isAppr()) {
    const me = r as "gc" | "cpo";
    if (!d)
      h =
        '<h2>Decision</h2><p class="muted">No recommendation yet.</p>' +
        (c.status !== "Disclosed"
          ? '<button class="btn" data-a="discl">Approve disclosure now</button>'
          : "");
    else {
      const v = (k: "gc" | "cpo") => {
        const x = d.votes[k];
        return (
          "<span>" +
          ROLES[k].name +
          ": " +
          (x
            ? '<span class="' +
              (x.vote === "approve" ? "t-ok" : "t-high") +
              '">' +
              (x.vote === "approve" ? "Approved" : "Rejected") +
              "</span>"
            : '<span class="muted">Waiting</span>') +
          "</span>"
        );
      };
      h =
        "<h2>" +
        (d.status === "Pending" && !d.votes[me]
          ? "Your decision"
          : "Decision: " + d.status) +
        '</h2><p style="margin:0"><b>' +
        esc(d.type) +
        '</b></p><div class="approvers">' +
        v("gc") +
        v("cpo") +
        "</div>";
      if (d.status === "Pending" && !d.votes[me])
        h +=
          '<div class="form"><label class="chk"><input type="checkbox" id="v1"> I have read the conflicts, the open FTC inquiry and the held payment</label><label>Reason<select id="vReason"><option>Facts support it</option><option>Facts contradict it</option><option>Regulator must be told</option></select></label><div class="row"><button class="btn primary" data-a="vote" data-x="approve">Approve</button><button class="btn danger" data-a="vote" data-x="reject">Reject</button></div></div>';
      else if (c.status === "Disclosed")
        h +=
          '<p class="t-ok" style="margin:0">Disclosure approved ' +
          fmtT(c.disclosedH ?? 0) +
          ".</p>";
      else if (d.status !== "Pending")
        h +=
          '<button class="btn primary" data-a="discl">Approve disclosure</button>';
    }
  } else if (r === "ceo")
    h =
      '<h2>Read-only access</h2><div class="caseacts"><span class="muted small">Case actions</span>' +
      act("approve", "Approve") +
      act("close", "Close case") +
      "</div>";
  else h = "<h2>Read-only access</h2>";
  return '<section class="panel action" id="actionbox">' + h + "</section>";
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
  const cf = c.conflicts;
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
  if (cf.length)
    o +=
      '<div class="alert high"><b>Recommendation contradicts the evidence</b><ul>' +
      cf.map((x) => "<li>" + esc(x) + "</li>").join("") +
      "</ul></div>";
  if (c.status === "Disclosure limited")
    o +=
      '<div class="alert warn"><b>Disclosure limited by both approvers</b>The decision and every step before it are permanently on record.</div>';
  o += caseSummary(c) + actionBox(c);
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
