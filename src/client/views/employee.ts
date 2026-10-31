// Employee "Speak up": report an incident, check a receipt.
import { ANSWERS, QUESTIONNAIRE, type Answer } from "@/domain/questionnaire";
import { esc } from "../html";
import { S } from "../store";
import { tracker, waitingOn } from "./case/timeline";

/** The same timeline Security, the approvers and the board see, for the receipt's case. */
function receiptTimeline(): string {
  const t = S.receipt?.track;
  if (!t) return "";
  return (
    '<p class="muted small" style="margin:6px 0 12px">Waiting on: ' +
    waitingOn(t.case, t) +
    "</p>" +
    tracker(t.case, t)
  );
}

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

export function vEmployee(): string {
  return (
    '<div class="pagehead"><div><h1>Report an Incident</h1><p class="lede"></p></div></div>' +
    (S.empMsg ? '<div class="alert ok">' + esc(S.empMsg) + "</div>" : "") +
    '<section class="panel"><h2></h2><div class="form"><label>What happened<textarea id="eTxt" rows="3" placeholder="What did you see or hear?"></textarea></label>' +
    questionList() +
    '<label class="chk"><input type="checkbox" id="eAnon" checked> Submit anonymously</label><div><button class="btn primary" data-a="report">Send report</button></div></div></section>' +
    // Stays open after a check so the answer and the case timeline are visible.
    '<details class="panel"' +
    (S.statusMsg ? " open" : "") +
    '><summary>Check a receipt code</summary><div class="row"><div class="form" style="flex:1"><input id="sCode" placeholder="RC-XXXX" value="' +
    esc(S.receipt?.code ?? "") +
    '"></div><button class="btn" data-a="status">Check</button></div>' +
    (S.statusMsg
      ? '<p style="margin:10px 0 0">' + esc(S.statusMsg) + "</p>"
      : "") +
    receiptTimeline() +
    "</details>"
  );
}
