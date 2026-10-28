// The mockup's actionBox() for the demo flow.
import { fmtT } from "@/domain/demo-time";
import { ROLES } from "@/domain/roles";
import type { CaseView } from "@/domain/view-state";
import { esc } from "../../html";
import { S } from "../../store";

const isSec = () => S.role === "security" || S.role === "cso";
const isAppr = () => S.role === "gc" || S.role === "cpo";

/** The demo flow (route NORMAL): Security, CSO, then the two keys. */
export function normalBox(c: CaseView): string {
  const r = S.role,
    d = c.decision;
  const act = (x: string, l: string) =>
    '<button class="btn sm" data-a="blocked" data-x="' +
    x +
    '">' +
    l +
    "</button>";
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
