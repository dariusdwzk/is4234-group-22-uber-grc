// A staff report waiting for its rating (route TRIAGE).
import type { CaseView } from "@/domain/view-state";
import { esc } from "../../html";
import { S } from "../../store";
import { remText } from "../components";

/** A staff report waiting for its rating: Security establishes facts, only the CPO rates. */
export function triageBox(c: CaseView): string {
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
