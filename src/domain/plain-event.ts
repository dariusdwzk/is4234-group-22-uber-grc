/** A ledger entry as the board's evidence log shows it (mockup: S.ledger items). */
export type LedgerView = {
  seq: number;
  /** Hours since Day 0. */
  t: number;
  actor: string;
  action: string;
  caseId: string;
  detail: string;
  hash: string;
};

export type EventCat = "detect" | "notice" | "work" | "decision" | "blocked";

export type PlainEvent = { cat: EventCat; text: string };

/** Label and colour class of each category chip, copied from the mockup's CATS. */
export const CATS: Record<EventCat, [label: string, cls: string]> = {
  detect: ["Detected", "sys"],
  notice: ["Board", "g"],
  work: ["Investigation", ""],
  decision: ["Decision", "a"],
  blocked: ["Blocked", "r"],
};

const staff = (who: string) =>
  who.startsWith("Anonymous") ? "A staff member (anonymous)" : "A staff member";

/** The mockup's plainEvent(): one plain sentence per entry, or null for low-level system entries. */
export function plainEvent(e: LedgerView): PlainEvent | null {
  const a = e.action,
    who = e.actor,
    d = e.detail;
  if (a === "Signal received") {
    const t = d.split(": ")[1] || d;
    if (who === "HackerOne")
      return { cat: "detect", text: "HackerOne received a " + t + "." };
    return { cat: "detect", text: who + " detected a " + t + "." };
  }
  if (a === "Case opened automatically")
    return {
      cat: "detect",
      text: "Case opened automatically. No one had to report it.",
    };
  if (a === "Classified HIGH")
    return { cat: "detect", text: "Rated high risk by the rules." };
  if (a === "Deadlines started")
    return { cat: "detect", text: "Legal notification deadlines started." };
  if (a.startsWith("Board notice sent"))
    return { cat: "notice", text: "Board notified: " + d };
  if (a === "Notice acknowledged")
    return { cat: "notice", text: "Board acknowledged a notice." };
  if (a === "Notice escalated to all directors")
    return {
      cat: "notice",
      text: "Notice not read within 24 hours. Sent to all directors.",
    };
  if (a === "Finding recorded")
    return {
      cat: "work",
      text: "Security team recorded a finding: " + d,
    };
  if (a === "Evidence added")
    return {
      cat: "work",
      text: who + " added evidence: " + d.split(" File: ")[0],
    };
  if (a === "Out-of-band contact attached")
    return { cat: "work", text: "CSO added the hacker’s email to the case." };
  if (a === "Recommendation sent")
    return {
      cat: "decision",
      // The CSO line is the mockup's; on the independent path the GC or CPO recommends.
      text: (who.startsWith("CSO") ? "CSO" : who) + " recommended: " + d + ".",
    };
  if (a.startsWith("Blocked: ")) {
    const what = a.slice(9).toLowerCase();
    return {
      cat: "blocked",
      text: who + " tried to " + what + ". Not allowed.",
    };
  }
  if (a === "Approved" || a === "Rejected")
    return {
      cat: "decision",
      text:
        who +
        " " +
        a.toLowerCase() +
        ": " +
        d.split(". ")[0]!.toLowerCase() +
        ".",
    };
  if (a === "Approved by both approvers")
    return {
      cat: "decision",
      text: "Both approvers agreed to escalate internally before disclosing.",
    };
  if (a === "Disclosure approved")
    return {
      cat: "decision",
      text: who + " approved notifying regulators and affected people.",
    };
  if (a === "Staff report received")
    return { cat: "work", text: staff(who) + " sent a report." };
  if (
    a === "Rated HIGH from questionnaire" ||
    a === "Rated LOW from questionnaire"
  )
    return {
      cat: "detect",
      text:
        "Rated " +
        (a.includes("HIGH") ? "high" : "low") +
        " risk by the rules, from the reporter’s answers.",
    };
  if (a === "Sent for triage: reporter unsure about impact")
    return {
      cat: "detect",
      text: "Sent for triage: the reporter was unsure about the impact.",
    };
  if (
    a === "Routed away from Security: concern about how an incident is handled"
  )
    return {
      cat: "detect",
      text: "Routed away from Security: the concern is about how an incident is handled.",
    };
  if (a.startsWith("Triage rating confirmed by Chief Privacy Officer: "))
    return {
      cat: "decision",
      text:
        "Chief Privacy Officer confirmed the rating: " +
        (a.endsWith("HIGH") ? "high" : "low") +
        " risk.",
    };
  if (a === "Triage timed out: rated HIGH automatically")
    return {
      cat: "notice",
      text: "No rating within 24 hours, so the report was rated high risk automatically.",
    };
  return null;
}
