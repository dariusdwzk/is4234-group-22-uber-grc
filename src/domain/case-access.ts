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
