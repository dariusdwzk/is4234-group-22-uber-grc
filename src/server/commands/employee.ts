import "server-only";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { AnswersSchema } from "@/domain/questionnaire";
import type { Actor } from "@/domain/types";
import type { ReceiptTrack } from "@/domain/view-state";
import { authorize } from "../authz";
import { getCase } from "../cases/engine";
import { openStaffReport } from "../cases/staff-report";
import { db, type Tx } from "../db/client";
import { receipts } from "../db/schema";
import { receiptTrack } from "../queries/receipt-track";
import { Forbidden } from "../errors";
import { logRefusal, runCommand, type CommandDef } from "../run-command";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** RC-XXXX: lets an anonymous employee follow up without revealing who they are. */
async function newReceipt(tx: Tx, caseId: string): Promise<string> {
  for (;;) {
    const code =
      "RC-" + Array.from({ length: 4 }, () => ALPHABET[randomInt(36)]).join("");
    const [taken] = await tx
      .select()
      .from(receipts)
      .where(eq(receipts.code, code));
    if (taken) continue;
    await tx.insert(receipts).values({ code, caseId });
    return code;
  }
}

const reportSchema = z.strictObject({
  text: z.string().trim().min(1).max(2000),
  anonymous: z.boolean(),
  answers: AnswersSchema,
});

/**
 * A staff report opens a case, rated from the employee's answers by the rules engine and
 * routed by routeReport(). The receipt code is all the employee needs to follow up.
 */
export const reportIncidentCommand: CommandDef<
  z.infer<typeof reportSchema>,
  { code: string }
> = {
  action: "reportIncident",
  blocked: "Blocked: Report incident",
  schema: reportSchema,
  handler: async (ctx, report) => {
    const { caseId } = await openStaffReport(ctx, report);
    return { code: await newReceipt(ctx.tx, caseId) };
  },
};

export const reportIncident = (actor: Actor | null, raw: unknown) =>
  runCommand(reportIncidentCommand, actor, raw);

/** Read-only: what happened to a report, by receipt code, with its timeline (mockup: A.status). */
export async function checkReceipt(
  actor: Actor | null,
  raw: unknown,
): Promise<{ message: string; track: ReceiptTrack | null }> {
  const auth = authorize(actor, "checkReceipt");
  if (!auth.ok) {
    await logRefusal(actor, "Blocked: Check receipt", null, auth.reason);
    throw new Forbidden(auth.reason);
  }
  const code = z
    .string()
    .trim()
    .toUpperCase()
    .catch("")
    .parse((raw as { code?: unknown } | null)?.code);
  const [r] = await db.select().from(receipts).where(eq(receipts.code, code));
  if (!r) return { message: "No submission matches that code.", track: null };
  const c = await getCase(db, r.caseId);
  return {
    message: "Case " + c.id + ": " + c.status + ".",
    track: await receiptTrack(c.id),
  };
}
