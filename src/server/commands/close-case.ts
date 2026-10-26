import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { gateState, type Decision } from "@/domain/gate";
import type { Actor } from "@/domain/types";
import { authorize } from "../authz";
import { db } from "../db/client";
import { cases, decisions } from "../db/schema";
import { Conflict, Forbidden, NotFound, ValidationError } from "../errors";
import { logRefusal } from "../run-command";

const schema = z.strictObject({ caseId: z.uuid() });
const ROLE_NAME = { GC: "General Counsel", PCO: "Privacy/Compliance" } as const;

/**
 * Nobody may close a HIGH case directly (US-11). This exists so the attempt is refused with the
 * missing approvals named and REFUSED logged. It never mutates, so it bypasses runCommand's
 * generic authz refusal (which could not name the missing approvals) but still denies by policy.
 */
export async function closeCase(
  actor: Actor | null,
  raw: unknown,
): Promise<never> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues);
  const auth = authorize(actor, "closeCase");
  if (auth.ok) throw new Error("closeCase must stay denied by policy");

  const [c] = actor
    ? await db.select().from(cases).where(eq(cases.id, parsed.data.caseId))
    : [];
  if (actor && !c) throw new NotFound();
  if (c && c.status !== "open") throw new Conflict("case is not open");

  let reason = auth.reason;
  if (c) {
    const rows = await db
      .select()
      .from(decisions)
      .where(eq(decisions.caseId, c.id));
    const state = gateState(
      rows.map((r) => ({
        approverId: r.approverId,
        approverRole: r.approverRole as "GC" | "PCO",
        outcome: r.outcome,
        notifyBy: r.notifyBy?.toISOString().slice(0, 10) ?? null,
        reasonCode: r.reasonCode as Decision["reasonCode"],
      })),
    );
    const missing =
      state.status === "awaiting"
        ? state.missing.map((r) => ROLE_NAME[r]).join(", ")
        : "agreement between the two approvers";
    reason = `Cannot close: a HIGH case closes only when General Counsel and Privacy/Compliance agree. Missing: ${missing}`;
  }
  await logRefusal(actor, "closeCase", reason);
  throw new Forbidden(reason);
}
