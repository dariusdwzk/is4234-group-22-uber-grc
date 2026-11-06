// A LOW staff report Security must review (route SECURITY_TRIAGE).
import { fmtT } from "@/domain/demo-time";
import type { CaseView } from "@/domain/view-state";
import { esc } from "../../html";
import { S } from "../../store";

/** A LOW staff report: Security must review it within 3 business days. */
export function reviewBox(c: CaseView): string {
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
