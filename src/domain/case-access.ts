import type { Route } from "./questionnaire";
import type { RoleKey } from "./types";

/** The CSO reports to Security, so both are on the Security side. */
const SECURITY_SIDE: readonly RoleKey[] = ["security", "cso"];

export const INDEPENDENT_REASON =
  "This case is about how an incident is handled, so it is handled independently of Security.";

/** A concern about how an incident is handled never reaches the people it is about. */
export function canAccessCase(role: RoleKey | null, route: Route): boolean {
  return !(
    route === "INDEPENDENT" &&
    role !== null &&
    SECURITY_SIDE.includes(role)
  );
}

export const APPROVERS: readonly RoleKey[] = ["gc", "cpo"];

export const NOT_ON_NORMAL_PATH =
  "On the normal path Security investigates and the CSO recommends. You decide.";

/**
 * Who may investigate (finding, evidence) and recommend on a case. On INDEPENDENT cases that
 * is the General Counsel and the Chief Privacy Officer; everywhere else it is Security's job.
 */
export function mayInvestigate(role: RoleKey | null, route: Route): boolean {
  if (role === null) return false;
  if (APPROVERS.includes(role)) return route === "INDEPENDENT";
  return canAccessCase(role, route);
}
