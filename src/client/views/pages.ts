// Ported from the mockup's views: header, landing, employee, security, finance, approvals, CEO.
import { dayOf, fmtT } from "@/domain/demo-time";
import { money } from "@/domain/money";
import { ANSWERS, QUESTIONNAIRE, type Answer } from "@/domain/questionnaire";
import { ROLES, ROLE_KEYS } from "@/domain/roles";
import { esc } from "../html";
import { S } from "../store";
import { caseTable, noticeRow, payBadge } from "./components";

const ANSWER_LABELS: Record<Answer, string> = {
  YES: "Yes",
  NO: "No",
  NOT_SURE: "Not sure",
};

/** The staff report questions, from rule-packs/staff-report-questions.json. */
function questionList(): string {
  return (
    '<ol class="qlist">' +
    QUESTIONNAIRE.questions
      .map(
        (q) =>
          '<li><span class="qtext" id="q-' +
          q.id +
          '-t">' +
          esc(q.text) +
          '</span><div class="seg" role="radiogroup" aria-labelledby="q-' +
          q.id +
          '-t">' +
          ANSWERS.map(
            (a) =>
              '<label><input type="radio" name="q-' +
              q.id +
              '" value="' +
              a +
              '"><span>' +
              ANSWER_LABELS[a] +
              "</span></label>",
          ).join("") +
          "</div></li>",
      )
      .join("") +
    "</ol>"
  );
}

export function header(): string {
  const opts =
    '<option value="">Choose a role</option>' +
    ROLE_KEYS.map(
      (k) =>
        '<option value="' +
        k +
        '"' +
        (S.role === k ? " selected" : "") +
        ">" +
        ROLES[k].name +
        "</option>",
    ).join("");
  return (
    '<header class="top"><button class="brand" data-a="landing">Disclosure Gate</button>' +
    '<label class="rolepick">Role <select id="roleSel">' +
    opts +
    "</select></label>" +
    '<span class="clock"><span class="day">' +
    dayOf(S.d.clockH) +
    "</span> " +
    fmtT(S.d.clockH) +
    "</span>" +
    '<button class="btn sm" data-a="menu" aria-expanded="' +
    S.menu +
    '">Demo ▾</button>' +
    (S.menu
      ? '<div class="menu"><div><h3>Time</h3><div class="row"><button class="btn sm" data-a="clock" data-x="24">+1 day</button>' +
        (S.d.jumped
          ? ""
          : '<button class="btn sm" data-a="jump">Jump to Day 24</button>') +
        "</div></div>" +
        '<div><h3>Demo</h3><div class="row"><button class="btn sm" data-a="guide">' +
        (S.guided ? "Hide guide" : "Show guide") +
        '</button><button class="btn sm danger" data-a="reset">Reset data</button></div></div></div>'
      : "") +
    "</header>"
  );
}

export function vLanding(): string {
  return (
    '<section class="hero"><h1>Who decides whether a breach is disclosed?</h1>' +
    '<p class="lede">Security investigates. The General Counsel and the Chief Privacy Officer decide. The board is told automatically. Every step is logged.</p>' +
    '<div class="row"><button class="btn primary big" data-a="startGuide">Start guided demo</button><span class="muted small">8 steps, about 4 minutes</span></div></section>' +
    '<details><summary>Or explore a role on your own</summary><div class="roles">' +
    ROLE_KEYS.map(
      (k) =>
        '<button class="rolecard" data-a="role" data-x="' +
        k +
        '"><b>' +
        ROLES[k].name +
        "</b><span>" +
        ROLES[k].short +
        "</span></button>",
    ).join("") +
    "</div></details>" +
    '<p class="muted small" style="margin-top:28px">Replays Uber’s 2016 breach with simulated data. Day 0 is the day the breach was found.</p>'
  );
}

export function vEmployee(): string {
  return (
    '<div class="pagehead"><div><h1>Speak up</h1><p class="lede">Report an incident or challenge a decision. You can stay anonymous.</p></div></div>' +
    (S.empMsg ? '<div class="alert ok">' + esc(S.empMsg) + "</div>" : "") +
    '<div class="cols2"><section class="panel"><h2>Challenge a decision</h2><div class="form"><label>Case reference<input id="cRef" value="' +
    esc(S.d.replayId ?? "") +
    '" placeholder="e.g. C-104"></label><label>Concern<textarea id="cTxt" rows="3">The attacker took user data and demanded money. This is not a bug bounty.</textarea></label><label class="chk"><input type="checkbox" id="cAnon" checked> Stay anonymous</label><div><button class="btn primary" data-a="challenge">Send challenge</button></div></div></section>' +
    '<section class="panel"><h2>Report an incident</h2><div class="form"><label>What happened<textarea id="eTxt" rows="3" placeholder="What did you see or hear?"></textarea></label>' +
    questionList() +
    '<label class="chk"><input type="checkbox" id="eAnon" checked> Submit anonymously</label><div><button class="btn primary" data-a="report">Send report</button></div></div></section></div>' +
    '<details class="panel"><summary>Check a receipt code</summary><div class="row"><div class="form" style="flex:1"><input id="sCode" placeholder="RC-XXXX"></div><button class="btn" data-a="status">Check</button></div>' +
    (S.statusMsg
      ? '<p style="margin-top:10px">' + esc(S.statusMsg) + "</p>"
      : "") +
    "</details>"
  );
}

export function vSecurity(): string {
  const unl = S.d.signals.filter((s) => !s.caseId).sort((a, b) => b.h - a.h);
  return (
    '<div class="pagehead"><div><h1>Security</h1><p class="lede">Cases open by themselves from system signals. You investigate and recommend.</p></div><button class="btn" data-a="showDeclare">+ Declare incident</button></div>' +
    (S.showDeclare
      ? '<section class="panel action"><h2>Declare an incident</h2><div class="form"><label>What happened<textarea id="dTxt" rows="2" placeholder="For incidents no system has flagged"></textarea></label><div class="row"><button class="btn primary" data-a="declare">Declare</button><button class="btn" data-a="showDeclare">Cancel</button></div></div></section>'
      : "") +
    '<div class="tabs"><button class="tab ' +
    (S.secTab === "cases" ? "on" : "") +
    '" data-a="secTab" data-x="cases">Cases (' +
    S.d.cases.length +
    ')</button><button class="tab ' +
    (S.secTab === "inbox" ? "on" : "") +
    '" data-a="secTab" data-x="inbox">Unlinked signals (' +
    unl.length +
    ")</button></div>" +
    (S.secTab === "inbox"
      ? '<section class="panel">' +
        (unl.length
          ? '<ul class="list">' +
            unl
              .map(
                (s) =>
                  '<li><span class="badge ' +
                  (s.origin === "system" ? "sys" : "warn") +
                  '">' +
                  esc(s.src) +
                  '</span><span class="grow">' +
                  esc(s.title) +
                  "</span></li>",
              )
              .join("") +
            "</ul>"
          : '<p class="muted">Every signal is in a case.</p>') +
        "</section>"
      : '<section class="panel">' + caseTable(S.d.cases) + "</section>")
  );
}

export function vFinance(): string {
  return (
    '<div class="pagehead"><div><h1>Payments</h1><p class="lede">Payments linked to an open high-risk case are held until the General Counsel and the Chief Privacy Officer both approve.</p></div></div>' +
    (S.finMsg
      ? '<div class="alert ' +
        S.finMsg.kind +
        '"><b>' +
        S.finMsg.title +
        "</b>" +
        esc(S.finMsg.text) +
        "</div>"
      : "") +
    '<section class="panel"><div class="scroll"><table class="tbl"><thead><tr><th>Payee</th><th>Amount</th><th>Case</th><th>Status</th><th></th></tr></thead><tbody>' +
    S.d.payments
      .slice()
      .reverse()
      .map(
        (p) =>
          "<tr><td>" +
          esc(p.payee) +
          '<div class="muted small">' +
          dayOf(p.t) +
          "</div></td><td>" +
          money(p.amountCents) +
          "</td><td>" +
          p.caseId +
          "</td><td>" +
          payBadge(p) +
          "</td><td>" +
          (p.status === "Released" || p.status === "Cancelled"
            ? ""
            : '<button class="btn sm ' +
              (p.status === "Held" ? "" : "primary") +
              '" data-a="release" data-x="' +
              p.id +
              '">Release payment</button>') +
          "</td></tr>",
      )
      .join("") +
    "</tbody></table></div>" +
    "</section>"
  );
}

export function vApprovals(): string {
  const role = S.role as "gc" | "cpo";
  const pend = S.d.cases.filter(
    (c) =>
      c.decision && c.decision.status === "Pending" && !c.decision.votes[role],
  );
  return (
    '<div class="pagehead"><div><h1>Decisions</h1><p class="lede">Limiting disclosure needs you and the ' +
    (role === "gc" ? "Chief Privacy Officer" : "General Counsel") +
    ".</p></div></div>" +
    '<section class="panel"><h2>Waiting for you</h2>' +
    (pend.length
      ? '<ul class="list">' +
        pend
          .map(
            (c) =>
              '<li><span class="grow"><b>' +
              c.id +
              "</b> " +
              esc(c.decision!.type) +
              '</span><button class="btn primary sm" data-a="openCase" data-x="' +
              c.id +
              '">Review</button></li>',
          )
          .join("") +
        "</ul>"
      : '<p class="muted">Nothing waiting.</p>') +
    "</section>" +
    triageList(role) +
    '<section class="panel"><h2>Handled independently of Security</h2><p class="muted small">Concerns about how an incident is handled. Security cannot see these.</p>' +
    caseTable(S.d.cases.filter((c) => c.route === "INDEPENDENT")) +
    "</section>" +
    '<section class="panel"><h2>High-risk cases</h2>' +
    caseTable(
      S.d.cases.filter(
        (c) => c.severity === "HIGH" && c.route !== "INDEPENDENT",
      ),
    ) +
    "</section>"
  );
}

/** The CPO rates staff reports the reporter was unsure about. */
function triageList(role: "gc" | "cpo"): string {
  const list = S.d.cases.filter((c) => c.status === "Needs triage");
  if (role !== "cpo" || !list.length) return "";
  return (
    '<section class="panel"><h2>Staff reports to rate</h2>' +
    caseTable(list) +
    "</section>"
  );
}

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
