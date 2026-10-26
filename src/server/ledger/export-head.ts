import "server-only";
import { eq } from "drizzle-orm";
import type { Tx } from "../db/client";
import { headExports, ledgerHead } from "../db/schema";
import { Conflict } from "../errors";
import { appendEntry } from "./append";

/** Simulated external auditor inbox (US-23): records the head, then logs HEAD_EXPORTED. */
export async function exportHead(
  tx: Tx,
  actorId: string,
  ts: string,
): Promise<{ seq: number; hash: string; entryCount: number }> {
  const [head] = await tx
    .select()
    .from(ledgerHead)
    .where(eq(ledgerHead.id, 1))
    .for("update");
  if (!head || head.seq === 0)
    throw new Conflict("ledger is empty; nothing to export");
  // Entries are contiguous from seq 1, so the count equals the head seq.
  const exported = { seq: head.seq, hash: head.hash, entryCount: head.seq };
  await tx
    .insert(headExports)
    .values({ ...exported, exportedAt: new Date(ts) });
  await appendEntry(tx, {
    actorId,
    eventType: "HEAD_EXPORTED",
    payload: exported,
    ts,
  });
  return exported;
}
