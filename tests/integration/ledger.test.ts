import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { GENESIS_PREV_HASH, entryHash } from "@/domain/hash";
import { db } from "@/server/db/client";
import { ledgerEntries, ledgerHead } from "@/server/db/schema";
import { appendEntry } from "@/server/ledger/append";
import { exportHead } from "@/server/ledger/export-head";
import { writeGenesis } from "@/server/ledger/genesis";
import { verifyChain } from "@/server/ledger/verify";
import { demoPool, resetTestDb } from "./setup/db";

const TS = "2026-10-27T00:00:00.000Z";
const ev = (i: number) => ({
  actorId: "u1",
  eventType: "EVENT_INGESTED" as const,
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
    await db.transaction((tx) => writeGenesis(tx, TS, "v1"));
  });

  it("genesis is seq 1 with the all-zero prev hash and is refused on a non-empty ledger", async () => {
    const [g] = await db.select().from(ledgerEntries);
    expect(g).toMatchObject({
      seq: 1,
      prevHash: GENESIS_PREV_HASH,
      eventType: "GENESIS",
      actorId: null,
    });
    expect(g!.payload).toEqual({ rulePackVersion: "v1" });
    await expect(
      db.transaction((tx) => writeGenesis(tx, TS, "v1")),
    ).rejects.toThrow(/genesis must be seq 1/);
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
    await db.transaction((tx) => writeGenesis(tx, TS, "v1"));
    expect(await verifyChain()).toMatchObject({ ok: true, count: 1 });
  });

  it("hash survives jsonb round trip", async () => {
    await db.transaction((tx) =>
      appendEntry(tx, {
        actorId: null,
        eventType: "EVENT_INGESTED",
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

  it("US-22: tamper via demo_admin then verify fails at that seq", async () => {
    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        db.transaction((tx) => appendEntry(tx, ev(i))),
      ),
    );
    await demoPool.query(
      `UPDATE ledger_entries SET payload = '{"i":999}' WHERE seq = 4`,
    );
    expect(await verifyChain()).toEqual({
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
    await demoPool.query("DELETE FROM ledger_entries WHERE seq = 3");
    expect(await verifyChain()).toEqual({
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

  it("export head then append more → matches true; tamper that seq → matches false", async () => {
    await db.transaction((tx) => appendEntry(tx, ev(1)));
    const exported = await db.transaction((tx) => exportHead(tx, "acc-1", TS));
    expect(exported).toMatchObject({ seq: 2, entryCount: 2 });
    await db.transaction((tx) => appendEntry(tx, ev(2)));

    const ok = await verifyChain();
    expect(ok).toMatchObject({ ok: true, count: 4 }); // genesis, 1, HEAD_EXPORTED, 2
    expect(ok.exportedHead).toEqual({
      seq: 2,
      hash: exported.hash,
      matches: true,
    });
    const [logged] = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.seq, 3));
    expect(logged).toMatchObject({
      eventType: "HEAD_EXPORTED",
      actorId: "acc-1",
    });

    // A tamperer who also recomputes this entry's hash passes the entry's own check; the next
    // link breaks and the independently exported head no longer matches.
    const [row] = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.seq, 2));
    const forged = entryHash({ ...row!, ts: row!.tsIso, payload: { i: 42 } });
    await demoPool.query(
      `UPDATE ledger_entries SET payload = '{"i":42}', hash = $1 WHERE seq = 2`,
      [forged],
    );
    const bad = await verifyChain();
    expect(bad).toMatchObject({
      ok: false,
      failedAtSeq: 3,
      reason: "prev_link",
    });
  });

  it("export head refuses an empty ledger", async () => {
    await resetTestDb();
    await expect(
      db.transaction((tx) => exportHead(tx, "acc-1", TS)),
    ).rejects.toThrow(/empty/);
  });

  it("verify on an empty ledger is ok at the genesis hash", async () => {
    await resetTestDb();
    expect(await verifyChain()).toEqual({
      ok: true,
      count: 0,
      headHash: GENESIS_PREV_HASH,
    });
  });
});
