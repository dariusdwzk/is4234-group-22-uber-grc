// Employee "Speak up": report an incident, check a receipt.
import { ANSWERS, QUESTIONNAIRE, type Answer } from "@/domain/questionnaire";
import { esc } from "../html";
import { S } from "../store";

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
    '<div class="pagehead"><div><h1>Speak up</h1><p class="lede">Report an incident. You can stay anonymous.</p></div></div>' +
    (S.empMsg ? '<div class="alert ok">' + esc(S.empMsg) + "</div>" : "") +
    '<section class="panel"><h2>Report an incident</h2><div class="form"><label>What happened<textarea id="eTxt" rows="3" placeholder="What did you see or hear?"></textarea></label>' +
    questionList() +
    '<label class="chk"><input type="checkbox" id="eAnon" checked> Submit anonymously</label><div><button class="btn primary" data-a="report">Send report</button></div></div></section>' +
    '<details class="panel"><summary>Check a receipt code</summary><div class="row"><div class="form" style="flex:1"><input id="sCode" placeholder="RC-XXXX"></div><button class="btn" data-a="status">Check</button></div>' +
    (S.statusMsg
      ? '<p style="margin-top:10px">' + esc(S.statusMsg) + "</p>"
      : "") +
    "</details>"
  );
}
