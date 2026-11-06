import "server-only";
import { GENESIS_PREV_HASH } from "@/domain/hash";
import type { Tx } from "../db/client";
import { ledgerHead } from "../db/schema";
import { appendEntry } from "./append";

/** Seq 1, prevHash = 64 zeros, event GENESIS (spec §5). Refuses to run on a non-empty ledger. */
export async function writeGenesis(tx: Tx, ts: string): Promise<void> {
  await tx
    .insert(ledgerHead)
    .values({ id: 1, seq: 0, hash: GENESIS_PREV_HASH })
    .onConflictDoNothing();
  const { seq } = await appendEntry(tx, {
    actorId: null,
    eventType: "GENESIS",
    payload: {},
    ts,
  });
  if (seq !== 1)
    throw new Error(`genesis must be seq 1, got ${seq}; ledger was not empty`);
}
