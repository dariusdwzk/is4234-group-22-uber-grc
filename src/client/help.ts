// "About this page": the guide card while exploring on your own (not the guided demo).
// It explains whatever page and role are on screen, in a sentence or two.
import type { CaseView } from "@/domain/view-state";
import { esc } from "./html";
import { S } from "./store";

type Help = { title: string; text: string };

function caseHelp(c: CaseView): Help {
  const r = S.role;
  if (c.status === "Needs triage")
    return r === "cpo"
      ? {
          title: "Rate this report",
          text: "The reporter was unsure about the impact. Read Security’s finding, then confirm HIGH or LOW with a reason. If nobody rates it within 24 hours, it becomes HIGH automatically.",
        }
      : r === "security"
        ? {
            title: "Establish the facts",
            text: "The reporter was unsure about the impact. Record what you found. Only the Chief Privacy Officer can rate it: try “Confirm rating” and see it refused and logged.",
          }
        : {
            title: "Waiting for triage",
            text: "The reporter was unsure about the impact, so the Chief Privacy Officer rates it. Unrated after 24 hours, it becomes HIGH automatically.",
          };
  if (c.route === "SECURITY_TRIAGE" && c.severity === "LOW")
    return r === "security"
      ? {
          title: "Review this low-risk report",
          text: "The rules rated it LOW from the reporter’s answers. Review it within 3 business days, or the board is told.",
        }
      : {
          title: "Low-risk staff report",
          text: "Rated LOW from the reporter’s answers. Security must review it within 3 business days, or the board is told.",
        };
  if (c.severity === "LOW")
    return {
      title: "Low-risk case",
      text: "No high-risk rule fired, so it was logged without needing approval.",
    };
  if (c.route === "INDEPENDENT")
    return r === "gc" || r === "cpo"
      ? {
          title: "Handled without Security",
          text: "The concern is about how an incident is handled, so Security cannot see this case. One of you investigates and recommends, with evidence; the other decides. Nobody approves their own recommendation.",
        }
      : {
          title: "Handled without Security",
          text: "The concern is about how an incident is handled, so only the General Counsel and the Chief Privacy Officer work on it.",
        };
  switch (r) {
    case "security":
      return {
        title: "Investigate",
        text: "This case opened by itself and the board was already told. Record what the investigation found. You can recommend, but never close the case or lower its risk: try “Case actions” to see.",
      };
    case "cso":
      return {
        title: "Recommend",
        text: "Attach messages no system saw, then recommend: escalate internally (needs a reason) or notify regulators. You report to Security, so you cannot approve. Try “Case actions”.",
      };
    case "gc":
    case "cpo":
      return {
        title: "Decide",
        text: "Read the reason first. Escalating internally needs both of you; notifying needs one. Either way the board is told.",
      };
    case "ceo":
      return {
        title: "Read-only",
        text: "You can follow every step of the case, but you cannot approve or close it. Those buttons are refused and logged.",
      };
    default:
      return {
        title: "The case record",
        text: "Everything that happened on this case, step by step. The board reads the same record.",
      };
  }
}

/** Help for the page on screen. */
export function pageHelp(): Help {
  const r = S.role;
  switch (S.view) {
    case "employee":
      return {
        title: "Speak up",
        text: "Employees report anything that worries them here, anonymously if they like. Seven quick questions decide who the report goes to. ",
      };
    case "security":
      return r === "cso"
        ? {
            title: "Security’s cases",
            text: "As CSO you lead Security. Open a case to attach messages no system saw and to recommend what to do. Your reporting line is Security, so you cannot approve.",
          }
        : {
            title: "Security’s cases",
            text: "Cases open by themselves from cloud monitoring, HackerOne and secret scanning. Open one to investigate. Cases that involve Security handles an incident never appear here.",
          };
    case "approvals":
      return {
        title: "Your decisions",
        text:
          (r === "cpo"
            ? "You also rate staff reports the reporter was unsure about. "
            : "") +
          "Holding back disclosure needs both the General Counsel and the Chief Privacy Officer; notifying needs one. Cases involving Security come straight to CPO.",
      };
    case "ceo":
      return {
        title: "Overview",
        text: "This is a read-only dashboard. CEO can see every high-risk case and what the board has been told.",
      };
    case "board":
      return S.boardTab === "log"
        ? {
            title: "The evidence log",
            text: "Every action is written here the moment it happens, and nobody can change it. Filter by “Blocked attempts” to see what people tried but were not allowed to do.",
          }
        : {
            title: "What the board is told",
            text: "Dashboard shows serious incidents. Board's only action is acknowledging them; real decisions happen in board meetings.",
          };
    case "case": {
      const c = S.d.cases.find((x) => x.id === S.caseId);
      return c
        ? caseHelp(c)
        : { title: "Case", text: "This case is not available to your role." };
    }
    default:
      return {
        title: "UberSecure",
        text: "Pick a role to explore, or start the guided demo.",
      };
  }
}

/** The guide card while exploring: explains this page; offers the guided demo instead. */
export function helpCard(): string {
  const h = pageHelp();
  return (
    '<aside class="guidecard" aria-label="Guide">' +
    '<div class="gc-top"><span>About this page</span><button class="link small" data-a="hideGuide">Hide</button></div>' +
    "<h3>" +
    esc(h.title) +
    "</h3><p>" +
    esc(h.text) +
    '</p><button class="link" data-a="startGuide">Take the guided demo instead</button>' +
    "</aside>"
  );
}
