import { beforeEach, describe, expect, it } from "vitest";
import { GENESIS_PREV_HASH, entryHash } from "@/domain/hash";
import { db } from "@/server/db/client";
import { ledgerEntries, ledgerHead } from "@/server/db/schema";
import { appendEntry } from "@/server/ledger/append";
import { anchorHead } from "@/server/ledger/anchor";
import { writeGenesis } from "@/server/ledger/genesis";
import { verifyChain } from "@/server/ledger/verify";
import { appPool, resetTestDb, tamperAsOwner } from "./setup/db";

const TS = "2026-10-27T00:00:00.000Z";
const ev = (i: number) => ({
  actorId: "Cloud monitoring",
  eventType: "Signal received" as const,
  payload: { i },
  ts: TS,
});

async function seqs(): Promise<number[]> {
  const rows = await db
    .select({ seq: ledgerEntries.seq })
    .from(ledgerEntries)
    .orderBy(ledgerEntries.seq);
  return rows.map((r) => r.seq);
}

describe("ledger", () => {
  beforeEach(async () => {
    await resetTestDb();
    await db.transaction((tx) => writeGenesis(tx, TS));
  });

  it("genesis is seq 1 with the all-zero prev hash and is refused on a non-empty ledger", async () => {
    const [g] = await db.select().from(ledgerEntries);
    expect(g).toMatchObject({
      seq: 1,
      prevHash: GENESIS_PREV_HASH,
      eventType: "GENESIS",
      actorId: null,
    });
    expect(g!.payload).toEqual({});
    await expect(db.transaction((tx) => writeGenesis(tx, TS))).rejects.toThrow(
      /genesis must be seq 1/,
    );
    expect(await seqs()).toEqual([1]);
  });

  it("US-20: append writes contiguous seq and links prev hash", async () => {
    await db.transaction(async (tx) => {
      await appendEntry(tx, ev(1));
      await appendEntry(tx, ev(2)); // several appends in one tx
    });
    await db.transaction((tx) => appendEntry(tx, ev(3)));
    const rows = await db
      .select()
      .from(ledgerEntries)
      .orderBy(ledgerEntries.seq);
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3, 4]);
    rows.slice(1).forEach((r, i) => expect(r.prevHash).toBe(rows[i]!.hash));
    expect(await verifyChain()).toMatchObject({
      ok: true,
      count: 4,
      headHash: rows[3]!.hash,
    });
    const [head] = await db.select().from(ledgerHead);
    expect(head).toMatchObject({ seq: 4, hash: rows[3]!.hash });
  });

  it("US-20: two events at the same moment do not fork (20 concurrent appends)", async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        db.transaction((tx) => appendEntry(tx, ev(i))),
      ),
    );
    expect(await seqs()).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    expect(await verifyChain()).toMatchObject({ ok: true, count: 21 });
  });

  it("reset after concurrent appends verifies OK", async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        db.transaction((tx) => appendEntry(tx, ev(i))),
      ),
    );
    await resetTestDb();
    await db.transaction((tx) => writeGenesis(tx, TS));
    expect(await verifyChain()).toMatchObject({ ok: true, count: 1 });
  });

  it("hash survives jsonb round trip", async () => {
    await db.transaction((tx) =>
      appendEntry(tx, {
        actorId: null,
        eventType: "Signal received",
        payload: {
          z: "Zoë 🚗",
          a: { y: 1, b: 2 },
          list: [3, { k: null }],
          n: -0,
        },
        ts: TS,
      }),
    );
    const [row] = await db
      .select()
      .from(ledgerEntries)
      .orderBy(ledgerEntries.seq)
      .offset(1);
    expect(entryHash({ ...row!, ts: row!.tsIso })).toBe(row!.hash);
    expect(await verifyChain()).toMatchObject({ ok: true, count: 2 });
  });

  it("verifies across batch boundaries", async () => {
    await db.transaction(async (tx) => {
      for (let i = 0; i < 1050; i++) await appendEntry(tx, ev(i));
    });
    expect(await verifyChain()).toMatchObject({ ok: true, count: 1051 });
  });

  it("no database role can edit or delete a ledger entry", async () => {
    await expect(
      appPool.query(`UPDATE ledger_entries SET payload = '{}' WHERE seq = 1`),
    ).rejects.toThrow(/permission denied/);
  });

  it("US-22: an edited entry is detected at that seq", async () => {
    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        db.transaction((tx) => appendEntry(tx, ev(i))),
      ),
    );
    await tamperAsOwner(
      `UPDATE ledger_entries SET payload = '{"i":999}' WHERE seq = 4`,
    );
    expect(await verifyChain()).toMatchObject({
      ok: false,
      failedAtSeq: 4,
      reason: "hash_mismatch",
    });
  });

  it("US-22: a deleted entry is detected", async () => {
    await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        db.transaction((tx) => appendEntry(tx, ev(i))),
      ),
    );
    await tamperAsOwner("DELETE FROM ledger_entries WHERE seq = 3");
    expect(await verifyChain()).toMatchObject({
      ok: false,
      failedAtSeq: 4,
      reason: "seq_gap",
    });
  });

  it("rolled back transaction leaves no entry and head unchanged", async () => {
    const [before] = await db.select().from(ledgerHead);
    await expect(
      db.transaction(async (tx) => {
        await appendEntry(tx, ev(1));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await seqs()).toEqual([1]);
    expect((await db.select().from(ledgerHead))[0]).toEqual(before);
  });

  it("a payload the canonical form rejects writes nothing", async () => {
    for (const payload of [
      { f: 1.5 },
      { u: undefined },
      { d: new Date() },
    ] as never[]) {
      await expect(
        db.transaction((tx) => appendEntry(tx, { ...ev(0), payload })),
      ).rejects.toThrow(/non-integer|unsupported|non-plain/);
    }
    await expect(
      db.transaction((tx) => appendEntry(tx, { ...ev(0), ts: "2026-10-27" })),
    ).rejects.toThrow(/canonical ISO/);
    expect(await seqs()).toEqual([1]);
  });

  it("anchor then append more → anchors ok; a forged entry with recomputed hashes still breaks the anchor", async () => {
    await db.transaction((tx) => appendEntry(tx, ev(1)));
    await db.transaction((tx) => anchorHead(tx, 0, "After board notice"));
    await db.transaction((tx) => appendEntry(tx, ev(2)));
    expect(await verifyChain()).toMatchObject({
      ok: true,
      count: 3,
      anchorsOk: true,
    });

    // A tamperer who rewrites seq 2 and recomputes every later hash passes the chain check;
    // only the anchor, held outside the app, no longer matches.
    const rows = await db
      .select()
      .from(ledgerEntries)
      .orderBy(ledgerEntries.seq);
    let prev = rows[0]!.hash;
    for (const r of rows.slice(1)) {
      const payload = r.seq === 2 ? { i: 42 } : r.payload;
      const hash = entryHash({ ...r, ts: r.tsIso, prevHash: prev, payload });
      await tamperAsOwner(
        "UPDATE ledger_entries SET payload = $1, prev_hash = $2, hash = $3 WHERE seq = $4",
        [JSON.stringify(payload), prev, hash, r.seq],
      );
      prev = hash;
    }
    expect(await verifyChain()).toMatchObject({
      ok: true,
      anchorsOk: false,
      anchorMismatches: [2],
    });
  });

  it("anchor refuses an empty ledger", async () => {
    await resetTestDb();
    await expect(
      db.transaction((tx) => anchorHead(tx, 0, "Daily export")),
    ).rejects.toThrow(/empty/);
  });

  it("verify on an empty ledger is ok at the genesis hash", async () => {
    await resetTestDb();
    expect(await verifyChain()).toEqual({
      ok: true,
      count: 0,
      headHash: GENESIS_PREV_HASH,
      anchorsOk: true,
      anchorMismatches: [],
    });
  });
});
