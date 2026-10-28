import "server-only";
import { asc, gt } from "drizzle-orm";
import {
  ChainVerifier,
  type LedgerRow,
  type VerifyResult,
} from "@/domain/ledger-verify";
import { db, type DbClient } from "../db/client";
import { externalAnchors, ledgerEntries } from "../db/schema";

const BATCH = 1000;

export type ChainVerification = VerifyResult & {
  anchorsOk: boolean;
  /** Anchor seqs whose stored hash no longer matches the ledger. */
  anchorMismatches: number[];
};

/** Read-only: recomputes the whole chain in seq order, then compares every external anchor. */
export async function verifyChain(
  client: DbClient = db,
): Promise<ChainVerification> {
  const verifier = new ChainVerifier();
  const hashBySeq = new Map<number, string>();
  let after = 0;
  for (;;) {
    const batch = await client
      .select()
      .from(ledgerEntries)
      .where(gt(ledgerEntries.seq, after))
      .orderBy(asc(ledgerEntries.seq))
      .limit(BATCH);
    if (batch.length === 0) break;
    for (const r of batch) {
      const row: LedgerRow = {
        seq: r.seq,
        prevHash: r.prevHash,
        ts: r.tsIso,
        actorId: r.actorId,
        eventType: r.eventType,
        payload: r.payload,
        hash: r.hash,
      };
      hashBySeq.set(r.seq, r.hash);
      if (verifier.push(row)) break;
    }
    if (!verifier.result().ok || batch.length < BATCH) break;
    after = batch[batch.length - 1]!.seq;
  }

  const anchors = await client.select().from(externalAnchors);
  const anchorMismatches = anchors
    .filter((a) => hashBySeq.get(a.seq) !== a.headHash)
    .map((a) => a.seq);
  return {
    ...verifier.result(),
    anchorsOk: anchorMismatches.length === 0,
    anchorMismatches,
  };
}
