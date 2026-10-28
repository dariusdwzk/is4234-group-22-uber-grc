// The mockup's guided tour. Progress comes from the server (S.d.progress), so a step counts
// as done whichever role is viewing; only the highlight is worked out in the browser.
import type { RoleKey } from "@/domain/types";
import { ROLES } from "@/domain/roles";
import { S } from "./store";

type Step = {
  role?: RoleKey;
  view?: string;
  alsoCase?: boolean;
  onCase?: boolean;
  jump?: boolean;
  title: string | (() => string);
  text: string | (() => string);
  target?: () => string;
  done: () => boolean;
};

const P = () => S.d.progress;
const id = () => S.d.replayId ?? "";

export const STEPS: Step[] = [
  {
    role: "security",
    view: "security",
    alsoCase: true,
    title: () =>
      S.view === "case" ? "Record what you found" : "A case opened by itself",
    text: () =>
      S.view === "case"
        ? "Within a day, Uber’s security team confirmed what was taken. Record the finding with “Add finding”. The case already existed before anyone in Security acted."
        : "Cloud monitoring flagged a mass download. Case " +
          id() +
          " opened, was rated HIGH and the board was told, with no one in Security acting. Click the case to open it.",
    target: () =>
      S.view === "case"
        ? '[data-a="finding"]'
        : '[data-a="openCase"][data-x="' + id() + '"]',
    done: () => P().finding,
  },
  {
    role: "cso",
    onCase: true,
    title: () =>
      !S.d.emailAttached
        ? "Attach the hacker’s email"
        : !P().recommended
          ? "Recommend keeping it internal"
          : "Try to close the case",
    text: () =>
      !S.d.emailAttached
        ? "The hacker emailed the CSO directly, so no system saw it. Click “Attach to case”."
        : !P().recommended
          ? "Send the prefilled recommendation to escalate internally, as the CSO kept it in-house in 2016. The reason goes on the record."
          : "Now try to make the case go away. Click “Close case” under Case actions. The CSO is not allowed to, and the attempt is logged.",
    target: () =>
      !S.d.emailAttached
        ? '[data-a="attach"]'
        : !P().recommended
          ? '[data-a="rec"]'
          : '[data-a="blocked"][data-x="close"]',
    done: () => P().recommended && P().csoBlocked,
  },
  {
    jump: true,
    title: "Jump to Day 24",
    text: "In 2016 the payout went through HackerOne on 8 December, 24 days after the hacker’s email. Move time forward to see the payment request arrive.",
    done: () => P().jumped,
  },
  {
    role: "finance",
    view: "finance",
    title: "Try to release the payment",
    text: "The HackerOne report and the US$100,000 request merged into the case on their own, and the payment was held. Click “Release payment” to see what Finance is allowed to do.",
    target: () => '[data-a="release"]',
    done: () => P().financeBlocked,
  },
  {
    role: "gc",
    onCase: true,
    title: "Approve as General Counsel",
    text: "This is the first of two approvals. Read the CSO’s reason first. Then tick the checkbox and click Approve.",
    target: () => "#actionbox",
    done: () => P().gcDone,
  },
  {
    role: "cpo",
    onCase: true,
    title: "Decide as Chief Privacy Officer",
    text: "This is the second of two approvals. Reject: the payment is cancelled and disclosure is required. Approve: the case stays internal, the payment stays frozen and the board is told.",
    target: () => "#actionbox",
    done: () => P().cpoDone,
  },
  {
    role: "board",
    view: "board",
    title: "Read the board’s view",
    text: () =>
      !S.boardOpen[id()]
        ? "The board sees each serious incident in one card. Click “View details” to see the notices sent about it."
        : "Acknowledge each notice. This records that the board has read it. Any decision is taken in a board meeting, not here.",
    target: () =>
      !S.boardOpen[id()]
        ? '[data-a="expand"][data-x="' + id() + '"]'
        : '[data-a="ack"]',
    done: () => P().allAcked,
  },
  {
    role: "board",
    view: "board",
    title: () =>
      S.boardTab === "log"
        ? "A record no one can change"
        : "Open the evidence log",
    text: () =>
      S.boardTab === "log"
        ? "Every action on a case is written here the moment it happens. No one, including IT staff, can change or delete an entry without it being detected. The record is checked automatically against copies held by the external auditor. Click “Blocked attempts” to see what people tried to do but were not allowed to."
        : "Open the Evidence log tab to see the permanent record of everything that happened on this case.",
    target: () =>
      S.boardTab === "log"
        ? '[data-a="logFilter"][data-x="blocked"]'
        : '[data-a="boardTab"][data-x="log"]',
    done: () => S.logFilter === "blocked",
  },
];

export const stepIdx = (): number => STEPS.findIndex((s) => !s.done());

export function atStep(s: Step): boolean {
  if (s.jump) return true;
  if (S.role !== s.role) return false;
  if (s.alsoCase && S.view === "case" && S.caseId === S.d.replayId) return true;
  if (s.onCase) return S.view === "case" && S.caseId === S.d.replayId;
  return S.view === s.view;
}

const txt = (x: string | (() => string)) => (typeof x === "function" ? x() : x);

export function guideCard(): string {
  const i = stepIdx();
  const dots =
    '<div class="dots">' +
    STEPS.map(
      (_, j) =>
        '<span class="dot ' +
        (i === -1 || j < i ? "done" : j === i ? "now" : "") +
        '"></span>',
    ).join("") +
    "</div>";
  if (i === -1)
    return (
      '<aside class="guidecard" aria-label="Guide">' +
      dots +
      '<h3>Demo complete</h3><p>Reset and choose Approve as the Chief Privacy Officer to see the other ending. You can also try the Employee role to send an anonymous report.</p><div class="row"><button class="btn primary" data-a="reset">Reset and replay</button><button class="link" data-a="hideGuide">Close</button></div></aside>'
    );
  const s = STEPS[i]!,
    here = atStep(s);
  let act: string;
  if (s.jump)
    act = '<button class="btn primary" data-a="jump">Jump to Day 24</button>';
  else if (here)
    act =
      '<span class="gc-hint">Click the highlighted area on the page.</span>';
  else
    act =
      '<button class="btn primary" data-a="goStep">Go as ' +
      ROLES[s.role!].name +
      "</button>";
  return (
    '<aside class="guidecard" aria-label="Guide">' +
    dots +
    '<div class="gc-top"><span>Step ' +
    (i + 1) +
    " of " +
    STEPS.length +
    (s.role ? ": " + ROLES[s.role].name : "") +
    '</span><button class="link small" data-a="hideGuide">Hide</button></div>' +
    "<h3>" +
    txt(s.title) +
    "</h3><p>" +
    txt(s.text) +
    "</p>" +
    act +
    "</aside>"
  );
}
