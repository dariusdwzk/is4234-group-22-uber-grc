import "server-only";
import { eq } from "drizzle-orm";
import type { Tx } from "../db/client";
import { externalAnchors, ledgerHead } from "../db/schema";

/** Copies the current head to external_anchors (mockup: anchor()). Silent: no ledger entry. */
export async function anchorHead(
  tx: Tx,
  now: number,
  reason: string,
): Promise<void> {
  const [head] = await tx
    .select()
    .from(ledgerHead)
    .where(eq(ledgerHead.id, 1))
    .for("update");
  if (!head || head.seq === 0)
    throw new Error("ledger is empty; nothing to anchor");
  await tx
    .insert(externalAnchors)
    .values({ seq: head.seq, headHash: head.hash, createdH: now, reason });
}
