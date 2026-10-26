import { describe, expect, it } from "vitest";
import {
  GENESIS_PREV_HASH,
  entryHash,
  sha256Hex,
  type LedgerHashInput,
} from "@/domain/hash";
import {
  ChainVerifier,
  verifyEntries,
  type LedgerRow,
} from "@/domain/ledger-verify";

function buildChain(n: number): LedgerRow[] {
  const rows: LedgerRow[] = [];
  let prevHash = GENESIS_PREV_HASH;
  for (let seq = 1; seq <= n; seq++) {
    const input: LedgerHashInput = {
      seq,
      prevHash,
      ts: `2026-10-27T00:00:0${seq}.000Z`,
      actorId: seq === 1 ? null : "u1",
      eventType: seq === 1 ? "GENESIS" : "EVENT_INGESTED",
      payload: { n: seq, tags: ["a", "b"] },
    };
    const hash = entryHash(input);
    rows.push({ ...input, hash });
    prevHash = hash;
  }
  return rows;
}

describe("entryHash", () => {
  it("matches the pinned known vector (guards accidental format change)", () => {
    expect(
      entryHash({
        seq: 1,
        prevHash: GENESIS_PREV_HASH,
        ts: "2026-10-27T00:00:00.000Z",
        actorId: null,
        eventType: "GENESIS",
        payload: { rulePackVersion: "v1" },
      }),
    ).toBe("243502637a5460d9c17bde2145f54d0ae1541092383e21e384874516f3d69c87");
  });

  it("sha256Hex returns lowercase 64-char hex", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("does not depend on payload key order", () => {
    const base = {
      seq: 2,
      prevHash: GENESIS_PREV_HASH,
      ts: "t",
      actorId: "a",
      eventType: "X",
    };
    expect(entryHash({ ...base, payload: { a: 1, b: 2 } })).toBe(
      entryHash({ ...base, payload: { b: 2, a: 1 } }),
    );
  });

  it("binds every field", () => {
    const base: LedgerHashInput = {
      seq: 2,
      prevHash: GENESIS_PREV_HASH,
      ts: "t",
      actorId: "a",
      eventType: "X",
      payload: {},
    };
    const h = entryHash(base);
    expect(entryHash({ ...base, seq: 3 })).not.toBe(h);
    expect(entryHash({ ...base, prevHash: "1".repeat(64) })).not.toBe(h);
    expect(entryHash({ ...base, ts: "u" })).not.toBe(h);
    expect(entryHash({ ...base, actorId: null })).not.toBe(h);
    expect(entryHash({ ...base, eventType: "Y" })).not.toBe(h);
    expect(entryHash({ ...base, payload: { k: 1 } })).not.toBe(h);
  });
});

describe("verifyEntries", () => {
  it("US-21: untouched chain verifies OK with count and head hash", () => {
    const rows = buildChain(5);
    expect(verifyEntries(rows)).toEqual({
      ok: true,
      count: 5,
      headHash: rows[4]!.hash,
    });
  });

  it("empty ledger verifies OK at genesis hash", () => {
    expect(verifyEntries([])).toEqual({
      ok: true,
      count: 0,
      headHash: GENESIS_PREV_HASH,
    });
  });

  it("US-22: payload altered at entry 3 fails at 3", () => {
    const rows = buildChain(5);
    rows[2] = { ...rows[2]!, payload: { n: 999 } };
    expect(verifyEntries(rows)).toEqual({
      ok: false,
      failedAtSeq: 3,
      reason: "hash_mismatch",
    });
  });

  it("hash recomputed after edit still fails at next entry", () => {
    const rows = buildChain(5);
    const edited: LedgerHashInput = { ...rows[2]!, payload: { n: 999 } };
    rows[2] = { ...edited, hash: entryHash(edited) };
    expect(verifyEntries(rows)).toEqual({
      ok: false,
      failedAtSeq: 4,
      reason: "prev_link",
    });
  });

  it("deleted entry detected", () => {
    const rows = buildChain(5);
    rows.splice(2, 1);
    expect(verifyEntries(rows)).toEqual({
      ok: false,
      failedAtSeq: 4,
      reason: "seq_gap",
    });
  });

  it("first entry must start at seq 1 with the genesis prev hash", () => {
    expect(verifyEntries(buildChain(3).slice(1))).toEqual({
      ok: false,
      failedAtSeq: 2,
      reason: "seq_gap",
    });
    const rows = buildChain(2);
    const bad: LedgerHashInput = { ...rows[0]!, prevHash: "f".repeat(64) };
    rows[0] = { ...bad, hash: entryHash(bad) };
    expect(verifyEntries(rows)).toEqual({
      ok: false,
      failedAtSeq: 1,
      reason: "prev_link",
    });
  });

  it("tail entry tampered is caught at the tail", () => {
    const rows = buildChain(5);
    rows[4] = { ...rows[4]!, eventType: "FORGED" };
    expect(verifyEntries(rows)).toEqual({
      ok: false,
      failedAtSeq: 5,
      reason: "hash_mismatch",
    });
  });
});

describe("ChainVerifier (incremental, used for batched DB reads)", () => {
  it("gives the same answer as verifyEntries when fed in batches", () => {
    const rows = buildChain(7);
    const v = new ChainVerifier();
    for (const r of rows.slice(0, 3)) expect(v.push(r)).toBeUndefined();
    for (const r of rows.slice(3)) expect(v.push(r)).toBeUndefined();
    expect(v.result()).toEqual(verifyEntries(rows));
  });

  it("stops at the first failure and keeps reporting it", () => {
    const rows = buildChain(5);
    rows[1] = { ...rows[1]!, payload: { n: 0 } };
    const v = new ChainVerifier();
    expect(v.push(rows[0]!)).toBeUndefined();
    expect(v.push(rows[1]!)).toEqual({
      ok: false,
      failedAtSeq: 2,
      reason: "hash_mismatch",
    });
    expect(v.push(rows[2]!)).toEqual({
      ok: false,
      failedAtSeq: 2,
      reason: "hash_mismatch",
    });
    expect(v.result()).toEqual({
      ok: false,
      failedAtSeq: 2,
      reason: "hash_mismatch",
    });
  });
});
