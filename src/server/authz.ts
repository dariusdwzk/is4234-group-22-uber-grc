import "server-only";
import type { Actor, Role } from "@/domain/types";

const ALL_ROLES = [
  "SA",
  "CISO",
  "GC",
  "PCO",
  "IA",
  "ACC",
  "EMP",
  "EXEC",
  "DEMO",
] as const satisfies readonly Role[];

// Spec §6. One table; deny by default. Commands first, then read actions.
export const POLICY = {
  login: ALL_ROLES,
  logout: ALL_ROLES,
  declareIncident: ["EMP", "SA", "CISO", "GC", "PCO"],
  ingestEvent: ["DEMO"],
  recordRecommendation: ["SA", "CISO"],
  // Nobody may close a HIGH case directly; the attempt exists so it is refused and logged (US-11).
  closeCase: [],
  recordMateriality: ["GC"],
  submitDecision: ["GC", "PCO"],
  raiseFlag: ALL_ROLES, // any signed-in user (F6)
  resolveFlag: ["ACC", "IA"],
  acknowledgeTier2: ["ACC"],
  exportHead: ["ACC", "IA"],
  verifyLedger: ["IA", "ACC", "DEMO"],
  publishRulePack: ["GC"],
  // Only the system actor sweeps; viewers trigger it on page load but never act as it.
  sweep: ["EXEC"],
  advanceClock: ["DEMO"],
  resetDemo: ["DEMO"],
  tamperEntry: ["DEMO"],
  viewCases: ["SA", "CISO", "GC", "PCO", "IA"],
  viewCase: ["SA", "CISO", "GC", "PCO", "IA"],
  viewBoard: ["ACC"],
  // IA verifies and exports, so IA must be able to read the ledger it verifies.
  // DEMO operates the tamper control on this page (spec §6).
  viewLedger: ["ACC", "IA", "DEMO"],
  viewDemo: ["DEMO"],
} as const satisfies Record<string, readonly Role[]>;

export type Action = keyof typeof POLICY;

// The only action that does not need a signed-in actor.
const PUBLIC_ACTIONS: ReadonlySet<Action> = new Set<Action>(["login"]);

export type AuthzResult = { ok: true } | { ok: false; reason: string };

export function authorize(actor: Actor | null, action: Action): AuthzResult {
  if (PUBLIC_ACTIONS.has(action)) return { ok: true };
  if (!actor) return { ok: false, reason: "not signed in" };
  const allowed = (
    Object.hasOwn(POLICY, action) ? POLICY[action] : []
  ) as readonly Role[];
  if (!allowed.includes(actor.role)) {
    return { ok: false, reason: `role ${actor.role} may not ${action}` };
  }
  return { ok: true };
}
