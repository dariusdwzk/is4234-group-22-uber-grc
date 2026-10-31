import "server-only";
import { ROLES, isRoleKey } from "@/domain/roles";
import type { Actor } from "@/domain/types";

export const ROLE_HEADER = "x-role";

/**
 * No login (demo only): the role picker sends X-Role and the server acts as that seeded role.
 * Unknown or missing roles get no actor, so every permissioned action is refused.
 */
export function actorFromRequest(req: Request): Actor | null {
  const role = req.headers.get(ROLE_HEADER);
  return isRoleKey(role) ? { role, name: ROLES[role].name } : null;
}
