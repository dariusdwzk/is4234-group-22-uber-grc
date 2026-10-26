import "server-only";
import { eq } from "drizzle-orm";
import { entryHash } from "@/domain/hash";
import type { JsonValue } from "@/domain/types";
import type { Tx } from "../db/client";
import { ledgerEntries, ledgerHead } from "../db/schema";
import type { LedgerEventType } from "./event-types";

export type { LedgerEventType } from "./event-types";

export type AppendInput = {
  actorId: string | null;
  eventType: LedgerEventType;
  payload: JsonValue;
  /** ISO-8601 UTC with milliseconds, exactly as it will be hashed and stored. */
  ts: string;
};

/**
 * The only function that writes ledger_entries. It takes a Tx (never the pool) and locks
 * ledger_head FOR UPDATE, so concurrent writers serialise and the chain cannot fork.
 * Safe to call several times in one transaction: the lock is held until commit.
 */
export async function appendEntry(
  tx: Tx,
  e: AppendInput,
): Promise<{ seq: number; hash: string }> {
  if (new Date(e.ts).toISOString() !== e.ts) {
    throw new Error(`ledger ts must be canonical ISO-8601 UTC, got ${e.ts}`);
  }
  const [head] = await tx
    .select()
    .from(ledgerHead)
    .where(eq(ledgerHead.id, 1))
    .for("update");
  if (!head)
    throw new Error("ledger_head row missing; seed it before appending");

  const seq = head.seq + 1;
  const hash = entryHash({
    seq,
    prevHash: head.hash,
    ts: e.ts,
    actorId: e.actorId,
    eventType: e.eventType,
    payload: e.payload, // canonicalJson inside entryHash rejects floats, dates, etc.
  });
  await tx.insert(ledgerEntries).values({
    seq,
    tsIso: e.ts,
    actorId: e.actorId,
    eventType: e.eventType,
    payload: e.payload,
    prevHash: head.hash,
    hash,
  });
  await tx.update(ledgerHead).set({ seq, hash }).where(eq(ledgerHead.id, 1));
  return { seq, hash };
}
