import type { Actor, RoleKey } from "@/domain/types";

// Deny by default: an action not listed here, or a role not in its list, is refused.
// Empty lists are deliberate: the attempt exists so it can be refused and logged.
export const POLICY = {
  reportIncident: ["employee"],
  raiseChallenge: ["employee"],
  checkReceipt: ["employee"],
  declareIncident: ["security", "cso"],
  recordFinding: ["security"],
  attachContact: ["cso"],
  recommend: ["security", "cso"],
  vote: ["gc", "cpo"],
  disclose: ["gc", "cpo"],
  confirmTriage: ["cpo"],
  closeCase: [],
  lowerSeverity: [],
  releasePayment: ["finance"],
  acknowledgeNotice: ["board"],
  viewCases: ["security", "cso", "gc", "cpo", "ceo", "board"],
  viewPayments: ["finance", "security", "cso", "gc", "cpo", "ceo", "board"],
  viewBoard: ["board"],
  viewNotices: ["security", "cso", "gc", "cpo", "ceo", "board"],
  advanceClock: [],
  jumpToDay24: [],
  resetDemo: [],
} as const satisfies Record<string, readonly RoleKey[]>;

export type Action = keyof typeof POLICY;

// The demo menu works with or without a role, as in the mockup. Callers still assert DEMO_MODE.
const DEMO_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  "advanceClock",
  "jumpToDay24",
  "resetDemo",
]);

export type AuthzResult = { ok: true } | { ok: false; reason: string };

// Refusals people are expected to try get a plain explanation instead of the generic one.
const REASONS: Partial<Record<Action, string>> = {
  confirmTriage:
    "Only the Chief Privacy Officer can confirm the rating. Security establishes the facts.",
};

export function authorize(actor: Actor | null, action: Action): AuthzResult {
  if (DEMO_ACTIONS.has(action)) return { ok: true };
  if (!actor?.role) return { ok: false, reason: "Choose a role first." };
  const allowed = (
    Object.hasOwn(POLICY, action) ? POLICY[action] : []
  ) as readonly RoleKey[];
  if (!allowed.includes(actor.role)) {
    return {
      ok: false,
      reason: REASONS[action] ?? `${actor.name} may not ${action}.`,
    };
  }
  return { ok: true };
}
