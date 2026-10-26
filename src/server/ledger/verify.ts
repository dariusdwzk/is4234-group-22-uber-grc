import "server-only";
import { asc, desc, eq, gt } from "drizzle-orm";
import {
  ChainVerifier,
  type LedgerRow,
  type VerifyResult,
} from "@/domain/ledger-verify";
import { db, type DbClient } from "../db/client";
import { headExports, ledgerEntries } from "../db/schema";

const BATCH = 1000;

export type ExportedHeadCheck = { seq: number; hash: string; matches: boolean };
export type ChainVerification = VerifyResult & {
  exportedHead?: ExportedHeadCheck;
};

/** Read-only: walks the whole chain in seq order and compares the latest exported head. */
export async function verifyChain(
  client: DbClient = db,
): Promise<ChainVerification> {
  const verifier = new ChainVerifier();
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
      if (verifier.push(row)) break;
    }
    if (!verifier.result().ok || batch.length < BATCH) break;
    after = batch[batch.length - 1]!.seq;
  }
  const result = verifier.result();

  const [exported] = await client
    .select()
    .from(headExports)
    .orderBy(desc(headExports.id))
    .limit(1);
  if (!exported) return result;
  const [atSeq] = await client
    .select({ hash: ledgerEntries.hash })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.seq, exported.seq));
  return {
    ...result,
    exportedHead: {
      seq: exported.seq,
      hash: exported.hash,
      matches: atSeq?.hash === exported.hash,
    },
  };
}
