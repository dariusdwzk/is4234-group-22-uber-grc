import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/domain/types";
import { db } from "@/server/db/client";
import { headExports, ledgerEntries } from "@/server/db/schema";
import { advanceClock } from "@/server/commands/advance-clock";
import { exportLedgerHead } from "@/server/commands/export-head";
import { resetDemo } from "@/server/commands/reset-demo";
import { tamperEntry } from "@/server/commands/tamper-entry";
import { Forbidden, NotFound } from "@/server/errors";
import { verifyChain } from "@/server/ledger/verify";
import { listLedger } from "@/server/queries/ledger";
import { seed } from "@/server/seed/seed";
import { SEED_USERS, type SeedKey } from "@/server/seed/users";
import { ownerDb, resetTestDb } from "./setup/db";

let who: Record<SeedKey, Actor>;

describe("ledger UI commands", () => {
  beforeEach(async () => {
    process.env.DEMO_MODE = "true";
    await resetTestDb();
    const ids = await ownerDb.transaction((tx) =>
      seed(tx, { demoPassword: "demo-password-12345", now: new Date() }),
    );
    who = Object.fromEntries(
      (Object.keys(SEED_USERS) as SeedKey[]).map((k) => [
        k,
        { id: ids[k]!, role: SEED_USERS[k].role, displayName: k },
      ]),
    ) as Record<SeedKey, Actor>;
    for (let i = 0; i < 6; i++) await advanceClock(who.demo, { hours: 1 });
  });
  afterEach(() => {
    process.env.DEMO_MODE = "true";
  });

  it("US-22: tamper entry 5 → verify fails at 5", async () => {
    expect((await verifyChain()).ok).toBe(true);
    await expect(tamperEntry(who.demo, { seq: 5 })).resolves.toEqual({
      seq: 5,
    });
    const res = await verifyChain();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.failedAtSeq).toBe(5);
  });

  it("US-22: DEMO_MODE=false tamper throws NotFound", async () => {
    process.env.DEMO_MODE = "false";
    await expect(tamperEntry(who.demo, { seq: 5 })).rejects.toBeInstanceOf(
      NotFound,
    );
    process.env.DEMO_MODE = "true";
    expect((await verifyChain()).ok).toBe(true);
  });

  it("tamper is refused for non-DEMO roles and logged", async () => {
    await expect(tamperEntry(who.ia, { seq: 5 })).rejects.toBeInstanceOf(
      Forbidden,
    );
    const rows = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.eventType, "REFUSED"));
    expect(rows).toHaveLength(1);
    expect((await verifyChain()).ok).toBe(true);
  });

  it("tamper rejects the genesis entry and unknown entries", async () => {
    await expect(tamperEntry(who.demo, { seq: 1 })).rejects.toThrow();
    await expect(tamperEntry(who.demo, { seq: 9999 })).rejects.toBeInstanceOf(
      NotFound,
    );
  });

  it("US-23: export head writes head_exports and HEAD_EXPORTED entry", async () => {
    const out = await exportLedgerHead(who.acc);
    const [row] = await db.select().from(headExports);
    expect(row!.seq).toBe(out.seq);
    expect(row!.hash).toBe(out.hash);
    const [last] = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.eventType, "HEAD_EXPORTED"));
    expect(last!.seq).toBe(out.seq + 1);
    const res = await verifyChain();
    expect(res.ok).toBe(true);
    expect(res.exportedHead?.matches).toBe(true);
  });

  it("US-23: tamper before export is caught by the exported head", async () => {
    await exportLedgerHead(who.ia);
    await tamperEntry(who.demo, { seq: 3 });
    const res = await verifyChain();
    expect(res.ok).toBe(false);
  });

  it("export head refused for SA", async () => {
    await expect(exportLedgerHead(who.sa)).rejects.toBeInstanceOf(Forbidden);
    expect(await db.select().from(headExports)).toHaveLength(0);
  });

  it("listLedger pages newest first, 50 per page, and is role-gated", async () => {
    for (let i = 0; i < 50; i++) await advanceClock(who.demo, { hours: 1 });
    const p1 = await listLedger(who.acc, { page: 1 });
    expect(p1.rows).toHaveLength(50);
    expect(p1.total).toBe(57);
    expect(p1.rows[0]!.seq).toBe(57);
    const p2 = await listLedger(who.ia, { page: 2 });
    expect(p2.rows.map((r) => r.seq)).toEqual([7, 6, 5, 4, 3, 2, 1]);
    expect(p1.rows[0]!.hashShort).toHaveLength(12);
    await expect(listLedger(who.sa, { page: 1 })).rejects.toBeInstanceOf(
      Forbidden,
    );
  });

  it("reset after concurrent appends verifies OK", async () => {
    const appends = Array.from({ length: 10 }, () =>
      advanceClock(who.demo, { hours: 1 }).catch(() => undefined),
    );
    await Promise.all([...appends, resetDemo(who.demo, "demo-password-12345")]);
    const res = await verifyChain();
    expect(res.ok).toBe(true);
    expect(res.ok && res.count).toBeGreaterThanOrEqual(2);
  });
});
