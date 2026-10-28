// A concern about how an incident is handled (route INDEPENDENT): Security never sees it.
// The GC or CPO investigates and recommends; the other one decides.
import { EVIDENCE_TYPES } from "@/domain/evidence";
import { fmtT } from "@/domain/demo-time";
import { otherApprover, type Approver } from "@/domain/gate";
import { ROLES } from "@/domain/roles";
import type { CaseView } from "@/domain/view-state";
import { esc } from "../../html";
import { S } from "../../store";

const evidenceForm = (): string =>
  '<h3 style="margin-top:14px">Add evidence</h3><div class="form"><label>Note<textarea id="evNote" rows="2" placeholder="What it is and where it came from"></textarea></label>' +
  '<label>File (optional: PDF, image or text, up to 2 MB)<input type="file" id="evFile" accept="' +
  EVIDENCE_TYPES.join(",") +
  '"></label><div><button class="btn" data-a="evidence">Add evidence</button></div></div>';

const findingPart = (c: CaseView): string =>
  !c.finding
    ? '<div class="form"><label>What the investigation found<textarea id="fTxt" rows="2"></textarea></label><div><button class="btn" data-a="finding">Add finding</button></div></div>'
    : '<p style="margin:0"><b>Finding:</b> ' + esc(c.finding) + "</p>";

export function independentBox(c: CaseView): string {
  const r = S.role;
  if (r !== "gc" && r !== "cpo")
    return '<section class="panel action" id="actionbox"><h2>Handled independently</h2><p class="muted" style="margin:0">The General Counsel and the Chief Privacy Officer handle this case. Security cannot see it.</p></section>';
  const me = r as Approver;
  const d = c.decision,
    author = c.rec?.author as Approver | undefined;
  let h: string;
  if (!c.rec) {
    h =
      '<h2>Investigate</h2><p class="muted small" style="margin:0 0 10px">Security cannot see this case. Record what you find, then recommend. The ' +
      ROLES[otherApprover(me)].name +
      " decides.</p>" +
      findingPart(c) +
      evidenceForm() +
      '<h3 style="margin-top:14px">Recommend</h3><div class="form"><label>Recommended action<select id="iAct"><option value="disclose">Notify regulators and affected people</option><option value="limit">Limit disclosure</option></select></label>' +
      '<label>Reason<textarea id="iReason" rows="2"></textarea></label>' +
      '<div><button class="btn primary" data-a="irec">Send to the ' +
      ROLES[otherApprover(me)].name +
      "</button></div></div>";
  } else if (d && d.status === "Pending" && author === me) {
    h =
      '<h2>Recommendation sent</h2><p style="margin:0"><b>' +
      esc(d.type) +
      '</b></p><p class="muted" style="margin:6px 0 0">You recommended this, so the ' +
      ROLES[otherApprover(me)].name +
      " decides. You can still add evidence.</p>" +
      evidenceForm();
  } else if (d && d.status === "Pending") {
    h =
      '<h2>Your decision</h2><p style="margin:0"><b>' +
      esc(d.type) +
      '</b></p><p class="muted small" style="margin:6px 0 10px">Recommended by the ' +
      ROLES[author!].name +
      ". You are the second key.</p>" +
      '<div class="form"><label class="chk"><input type="checkbox" id="v1"> I have read the findings and the evidence</label><label>Reason<select id="vReason"><option>Facts support it</option><option>Facts contradict it</option><option>Regulator must be told</option></select></label><div class="row"><button class="btn primary" data-a="vote" data-x="approve">Approve</button><button class="btn danger" data-a="vote" data-x="reject">Reject</button></div></div>';
  } else {
    h =
      "<h2>Decision: " +
      esc(d?.status ?? "") +
      '</h2><p style="margin:0"><b>' +
      esc(d?.type ?? "") +
      "</b></p>" +
      (c.status === "Disclosed"
        ? '<p class="t-ok" style="margin:6px 0 0">Disclosure approved ' +
          fmtT(c.disclosedH ?? 0) +
          ".</p>"
        : '<div style="margin-top:10px"><button class="btn primary" data-a="discl">Approve disclosure</button></div>');
  }
  return '<section class="panel action" id="actionbox">' + h + "</section>";
}

/** The evidence on a case, for everyone allowed to see the case. */
export function evidencePanel(c: CaseView): string {
  if (!c.evidence.length) return "";
  return (
    '<section class="panel"><h2>Evidence (' +
    c.evidence.length +
    ')</h2><ul class="list">' +
    c.evidence
      .map(
        (e) =>
          '<li><span class="muted small" style="width:8rem;flex:none">' +
          ROLES[e.author].name +
          '</span><span class="grow">' +
          esc(e.note) +
          (e.file
            ? '<div class="muted small">' +
              esc(e.file.name) +
              ", " +
              Math.ceil(e.file.size / 1024) +
              ' KB · <span class="hash">SHA-256 ' +
              e.file.sha256.slice(0, 12) +
              "…</span></div>"
            : "") +
          "</span>" +
          (e.file
            ? '<button class="btn sm" data-a="download" data-x="' +
              e.id +
              '">Download</button>'
            : "") +
          "</li>",
      )
      .join("") +
    "</ul></section>"
  );
}
