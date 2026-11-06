import "server-only";
import { z } from "zod";
import {
  ATTEMPT_LABELS,
  blockedReason,
  type Attempt,
} from "@/domain/blocked-reasons";
import { INDEPENDENT_REASON, canAccessCase } from "@/domain/case-access";
import type { Actor } from "@/domain/types";
import { authorize, type Action } from "../authz";
import { getCase } from "../cases/engine";
import { db } from "../db/client";
import { Conflict, Forbidden, ValidationError } from "../errors";
import { logRefusal } from "../run-command";

const schema = z.strictObject({
  caseId: z.string(),
  action: z.enum(["close", "downgrade", "approve"]),
});

const ACTION_FOR: Record<Attempt, Action> = {
  close: "closeCase",
  downgrade: "lowerSeverity",
  approve: "vote",
};

/**
 * The "Case actions" buttons Security, the CSO and the CEO see but may not use. Every
 * attempt is refused with 403 and written to the ledger as evidence (mockup: A.blocked).
 */
export async function attemptAction(
  actor: Actor | null,
  raw: unknown,
): Promise<never> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues);
  const { caseId, action } = parsed.data;
  const c = await getCase(db, caseId); // 404 for an unknown case, before anything is logged
  if (authorize(actor, ACTION_FOR[action]).ok)
    throw new Conflict("Use the decision form to vote."); // only GC and CPO; they never see this button
  const why = canAccessCase(actor?.role ?? null, c.route)
    ? blockedReason(actor?.role ?? null, action)
    : INDEPENDENT_REASON;
  await logRefusal(actor, `Blocked: ${ATTEMPT_LABELS[action]}`, caseId, why);
  throw new Forbidden(why);
}
