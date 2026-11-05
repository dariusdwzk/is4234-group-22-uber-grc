// The mockup's actionBox() for the demo flow.
import { fmtT } from "@/domain/demo-time";
import { DISCLOSE_TYPE, ESCALATE_TYPE } from "@/domain/gate";
import { ROLES } from "@/domain/roles";
import type { CaseView } from "@/domain/view-state";
import { esc } from "../../html";
import { S } from "../../store";

/**
 * A text box. In the guided demo it is prefilled with the 2016 replay's words; when
 * exploring it starts empty, with a hint.
 */
const box = (id: string, hint: string, demoText: string) =>
  '<textarea id="' +
  id +
  '" rows="2" placeholder="' +
  esc(hint) +
  '">' +
  (S.mode === "demo" ? esc(demoText) : "") +
  "</textarea>";

/** Whether the CSO already attached an out-of-band message to this case. */
const hasAttachment = (c: CaseView) =>
  c.signals.some(
    (id) => S.d.signals.find((x) => x.id === id)?.src === "Email to CSO",
  );

/** A recommendation card. In the guided tour "escalate" starts selected (the 2016 choice). */
const choice = (v: string, title: string, sub: string) =>
  '<label class="choice"><input type="radio" name="rAct" value="' +
  v +
  '"' +
  (S.mode === "demo" && v === "escalate" ? " checked" : "") +
  "><span><b>" +
  esc(title) +
  '</b><span class="muted small">' +
  sub +
  "</span></span></label>";

const isSec = () => S.role === "security" || S.role === "cso";
const isAppr = () => S.role === "gc" || S.role === "cpo";

/** The demo flow (route NORMAL): Security, CSO, then the two keys. */
export function normalBox(c: CaseView): string {
  const r = S.role,
    d = c.decision;
  let h = "";
  if (isSec()) {
    if (r === "security") {
      if (!c.finding)
        h =
          '<h2>Investigation finding</h2><div class="form"><label>What the investigation confirmed' +
          box(
            "fTxt",
            "What did the investigation confirm? What was accessed, how, and how much?",
            "Confirmed: 16 objects copied from rider-backup using an AWS key last rotated in 2013. Includes about 600,000 driver licence numbers.",
          ) +
          '</label><div><button class="btn primary" data-a="finding">Add finding</button></div></div>';
      else
        h =
          '<h2>Finding recorded</h2><p class="muted" style="margin:0">' +
          esc(c.finding) +
          "</p>" +
          (!c.rec
            ? '<p class="muted small" style="margin:8px 0 0">Waiting for the CSO’s recommendation.</p>'
            : "");
    } else if (!c.rec)
      // Optional first: a message no monitored system saw. Then the recommendation itself.
      h =
        (hasAttachment(c)
          ? ""
          : '<h2>Attach out-of-band contact <span class="muted small">(optional)</span></h2><div class="form"><label>Message received outside monitored systems' +
            box(
              "aTxt",
              "Paste or summarise the message: who sent it, how it arrived, what it says.",
              "Email to the CSO from an anonymous sender: “We have your rider data. We expect a six-figure payment.”",
            ) +
            '</label><div><button class="btn" data-a="attach">Attach to case</button></div></div>' +
            '<div style="margin-top:22px"></div>') +
        '<h2>Recommendation</h2><div class="form"><fieldset><legend>Recommendation</legend>' +
        choice(
          "escalate",
          ESCALATE_TYPE,
          "Needs both General Counsel and Chief Privacy Officer.",
        ) +
        choice(
          "disclose",
          DISCLOSE_TYPE,
          "Needs General Counsel or Chief Privacy Officer.",
        ) +
        "</fieldset>" +
        // Prefilled for the replay: in 2016 the CSO kept it in-house as a "bug bounty".
        "<label>Reason (required to escalate)" +
        box(
          "rReason",
          "Why do you recommend this? Required to escalate internally.",
          "Treat it as a bug bounty and keep it in-house while we confirm the data was deleted.",
        ) +
        "</label>" +
        '<div><button class="btn primary" data-a="rec">Send to approvers</button><p class="muted small" style="margin:6px 0 0">The General Counsel and the Chief Privacy Officer are notified.</p></div></div>';
    else
      h =
        '<h2>Recommendation sent</h2><p class="muted" style="margin:0">Waiting for the General Counsel and the Chief Privacy Officer.</p>';
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
        const st = x
          ? x.vote === "approve"
            ? "approved"
            : "rejected"
          : k === S.role
            ? "you"
            : "pending";
        return '<span class="badge">' + ROLES[k].name + " · " + st + "</span>";
      };
      h =
        "<h2>" +
        (d.status === "Pending" && !d.votes[me]
          ? "Your decision"
          : "Decision: " + d.status) +
        '</h2><p style="margin:0"><b>' +
        esc(d.type) +
        "</b></p>" +
        (c.rec?.reason
          ? '<p class="muted" style="margin:4px 0 0">Reason: ' +
            esc(c.rec.reason) +
            "</p>"
          : "") +
        '<div class="approvers">' +
        v("gc") +
        v("cpo") +
        "</div>";
      if (d.status === "Pending" && !d.votes[me])
        h +=
          '<div class="form"><label class="chk"><input type="checkbox" id="v1"> I have read the reason and the open FTC inquiry</label><label>Reason<select id="vReason"><option>Facts support it</option><option>Facts contradict it</option><option>Regulator must be told</option></select></label><div class="row"><button class="btn primary" data-a="vote" data-x="approve">Approve</button><button class="btn danger" data-a="vote" data-x="reject">Reject</button></div></div>';
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
      '<h2>Status</h2><p style="margin:0">' +
      esc(d ? "Decision: " + d.status : c.status) +
      "</p>";
  else h = "<h2>Read-only access</h2>";
  return '<section class="panel action" id="actionbox">' + h + "</section>";
}
