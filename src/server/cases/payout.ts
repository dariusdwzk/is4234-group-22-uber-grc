import "server-only";
import { eq } from "drizzle-orm";
import { heldPaymentText } from "@/domain/payment";
import { signals } from "../db/schema";
import type { CommandCtx } from "../run-command";
import { addToCase, getCase, insertSignal } from "./engine";

const AMOUNT_CENTS = 10_000_000;

/**
 * The 2016 story: keeping the breach internal meant paying the attacker through the bug
 * bounty. When the replay case (the one SIG-201 opened) is recommended for internal
 * escalation, Finance records the US$100,000 request and it is held: the case is high risk,
 * and nothing in the app releases a held payment.
 */
export async function payoutRequest(
  ctx: CommandCtx,
  caseId: string,
): Promise<void> {
  const { tx, now, log } = ctx;
  const [replay] = await tx
    .select({ caseId: signals.caseId })
    .from(signals)
    .where(eq(signals.id, "SIG-201"));
  if (replay?.caseId !== caseId) return;

  const id = await insertSignal(tx, {
    source: "Finance",
    origin: "system",
    detectedH: now,
    title: "Payment request: US$100,000 to jdough (unverified)",
    entityKeys: ["jdough"],
    facts: { paymentCents: AMOUNT_CENTS, payeeVerified: false },
  });
  await log("Signal received", null, id + ": payment request US$100,000", {
    actor: "Finance",
  });
  await addToCase(ctx, caseId, id, "linked by the payee.");
  const c = await getCase(tx, caseId);
  await log(
    "Payment held",
    caseId,
    heldPaymentText(c.facts) + ". Held while the case is high risk.",
    { actor: "System" },
  );
}
