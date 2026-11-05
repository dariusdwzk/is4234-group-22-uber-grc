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
  if (!c.rec)
    return {
      verb: "Review and decide",
      line: "A decision is waiting for your vote.",
    };
  const reason = c.rec.reason;
  return {
    verb: "Review and decide",
    line:
      ROLES[c.rec.author].name +
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

/** The soonest running legal clock on an undisclosed case (internal clocks excluded), or null. */
export function nearestDeadline(
  cases: CaseView[],
  clockH: number,
): { h: number; name: string; caseId: string } | null {
  const all = cases
    .filter((c) => c.status !== "Disclosed")
    .flatMap((c) => c.clocks.map((k) => ({ k, caseId: c.id })))
    .filter(
      ({ k }) =>
        k.start !== null &&
        k.dur !== null &&
        !k.met &&
        k.key !== "class" &&
        k.key !== "mat",
    )
    .map(({ k, caseId }) => ({
      h: k.start! + k.dur! - clockH,
      name: k.name,
      caseId,
    }));
  return all.length ? all.reduce((a, b) => (b.h < a.h ? b : a)) : null;
}
