// What is waiting on the signed-in role: one line and one button per case.
import { ROLES } from "@/domain/roles";
import type { RoleKey } from "@/domain/types";
import type { CaseView } from "@/domain/view-state";
import { actionRequired } from "./action-required";

export type WorkItem = { c: CaseView; line: string; verb: string };

function describe(c: CaseView, role: RoleKey): Omit<WorkItem, "c"> {
  const triage = c.status === "Needs triage";
  if (triage && role === "cpo")
    return {
      verb: "Rate report",
      line: "The reporter was unsure about the impact.",
    };
  if (
    role === "security" &&
    (triage || (c.route === "SECURITY_TRIAGE" && c.severity === "LOW"))
  )
    return {
      verb: "Record finding",
      line: "Staff report waiting for Security's facts.",
    };
  if (c.status === "Disclosure required")
    return {
      verb: "Approve disclosure",
      line: "The decision was rejected, so disclosure is required.",
    };
  if (c.route === "INDEPENDENT" && !c.rec)
    return {
      verb: "Investigate",
      line: "One of you investigates and recommends; the other decides.",
    };
  if (role === "cso")
    return {
      verb: "Recommend",
      line: "Security's finding is in. Recommend what to do.",
    };
  if (role === "security")
    return {
      verb: "Record finding",
      line: "Opened automatically from system signals.",
    };
  const reason = c.rec?.reason;
  return {
    verb: "Review and decide",
    line:
      (c.rec ? ROLES[c.rec.author].name : "Someone") +
      " recommends: " +
      (c.decision?.type ?? "") +
      (reason ? ` · “${reason}”` : ""),
  };
}

/** Cases that need this role now: HIGH first, then by id. */
export function workItems(cases: CaseView[], role: RoleKey): WorkItem[] {
  return cases
    .filter((c) => actionRequired(c, role))
    .sort(
      (a, b) =>
        Number(b.severity === "HIGH") - Number(a.severity === "HIGH") ||
        a.id.localeCompare(b.id),
    )
    .map((c) => ({ c, ...describe(c, role) }));
}

/** Hours until the soonest running legal clock on an undisclosed case, or null. */
export function nearestDeadlineH(
  cases: CaseView[],
  clockH: number,
): number | null {
  const left = cases
    .filter((c) => c.status !== "Disclosed")
    .flatMap((c) => c.clocks)
    .filter((k) => k.start !== null && k.dur !== null && !k.met)
    .map((k) => k.start! + k.dur! - clockH);
  return left.length ? Math.min(...left) : null;
}
