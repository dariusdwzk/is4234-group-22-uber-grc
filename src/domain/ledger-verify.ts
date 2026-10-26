import { GENESIS_PREV_HASH, entryHash, type LedgerHashInput } from "./hash";

export type LedgerRow = LedgerHashInput & { hash: string };

export type VerifyFailure = {
  ok: false;
  failedAtSeq: number;
  reason: "hash_mismatch" | "prev_link" | "seq_gap";
};
export type VerifyResult =
  { ok: true; count: number; headHash: string } | VerifyFailure;

/**
 * Incremental chain check so the DB layer can stream rows in batches.
 * Per row, in order: seq contiguity, prev-hash link, recomputed hash. Contiguity comes
 * first so a deleted entry is reported as seq_gap rather than as a broken link.
 */
export class ChainVerifier {
  private count = 0;
  private headHash = GENESIS_PREV_HASH;
  private failure: VerifyFailure | undefined;

  /** Returns the failure once one is found (and on every later call), else undefined. */
  push(row: LedgerRow): VerifyFailure | undefined {
    if (this.failure) return this.failure;
    const fail = (reason: VerifyFailure["reason"]): VerifyFailure => {
      this.failure = { ok: false, failedAtSeq: row.seq, reason };
      return this.failure;
    };
    if (row.seq !== this.count + 1) return fail("seq_gap");
    if (row.prevHash !== this.headHash) return fail("prev_link");
    if (entryHash(row) !== row.hash) return fail("hash_mismatch");
    this.count += 1;
    this.headHash = row.hash;
    return undefined;
  }

  result(): VerifyResult {
    return (
      this.failure ?? { ok: true, count: this.count, headHash: this.headHash }
    );
  }
}

export function verifyEntries(rows: LedgerRow[]): VerifyResult {
  const v = new ChainVerifier();
  for (const row of rows) if (v.push(row)) break;
  return v.result();
}
