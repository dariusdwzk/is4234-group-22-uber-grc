import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { money } from "@/domain/money";
import { canRelease } from "@/domain/payments";
import type { Actor } from "@/domain/types";
import { payments } from "../db/schema";
import { Conflict, Forbidden, NotFound } from "../errors";
import { runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({ paymentId: z.string() });

/**
 * Finance releases a payment. A payment held on an open HIGH case is refused, and the
 * attempt is logged, until both approvers lift the hold (mockup: A.release).
 */
export const releasePaymentCommand: CommandDef<z.infer<typeof schema>, void> = {
  action: "releasePayment",
  blocked: "Blocked: Release payment",
  schema,
  handler: async ({ tx, log }, { paymentId }) => {
    const [p] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId));
    if (!p) throw new NotFound("No payment " + paymentId);
    const r = canRelease(p);
    const what = money(p.amountCents) + " to " + p.payee + ". ";
    if ("noop" in r)
      throw new Conflict("This payment is " + p.status.toLowerCase() + ".");
    if (!r.ok)
      throw new Forbidden(r.reason, {
        caseId: p.caseId,
        detail: what + r.reason,
      });
    await tx
      .update(payments)
      .set({ status: "Released" })
      .where(eq(payments.id, p.id));
    await log(
      "Payment released",
      p.caseId,
      what + "Approved by the General Counsel and the Chief Privacy Officer.",
    );
  },
};

export const releasePayment = (actor: Actor | null, raw: unknown) =>
  runCommand(releasePaymentCommand, actor, raw);
