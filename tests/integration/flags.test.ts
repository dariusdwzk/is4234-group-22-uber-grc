import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/domain/types";
import { db } from "@/server/db/client";
import {
  boardItems,
  cases,
  challengeFlags,
  ledgerEntries,
} from "@/server/db/schema";
import { ingestEvent } from "@/server/commands/ingest-event";
import { raiseFlag } from "@/server/commands/raise-flag";
import { resolveFlag } from "@/server/commands/resolve-flag";
import { Conflict, Forbidden } from "@/server/errors";
import { verifyChain } from "@/server/ledger/verify";
import { getBoard } from "@/server/queries/board";
import { seed } from "@/server/seed/seed";
import { SEED_USERS, type SeedKey } from "@/server/seed/users";
import { ownerDb, resetTestDb } from "./setup/db";

let who: Record<SeedKey, Actor>;

describe("challenge flags", () => {
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
    // A LOW case (blocked login only): R-FLAG is what can make it HIGH.
    await ingestEvent(who.demo, {
      kind: "blocked_login",
      occurredAt: new Date().toISOString(),
      correlationKey: "LOW-1",
      payload: { account: "svc-batch-01" },
    });
  });
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });

  const flag = (a: Actor, caseRef = "CASE-0001") =>
    raiseFlag(a, { caseRef, text: "I think this was mishandled." });

  it("US-18: EMP flag creates Tier 2 and R-FLAG fires", async () => {
    const [before] = await db.select().from(cases);
    expect(before).toMatchObject({ tier: "LOW", status: "auto_closed" });
    const out = await flag(who.emp);
    expect(out.matched).toBe(true);
    const [f] = await db.select().from(challengeFlags);
    expect(f).toMatchObject({ raisedBy: who.emp.id, status: "open" });
    const t2 = await db.select().from(boardItems).where(eq(boardItems.tier, 2));
    expect(t2.map((r) => r.reasonKey)).toEqual([`flag:${f!.id}`]);
    const [after] = await db.select().from(cases);
    expect(after).toMatchObject({ tier: "HIGH", status: "open" });
    expect((await getBoard(who.acc)).tier1).toHaveLength(1);
    expect((await verifyChain()).ok).toBe(true);
  });

  it("an unknown case ref is not dropped: ledgered and shown on the board", async () => {
    const out = await flag(who.emp, "CASE-9999");
    expect(out.matched).toBe(false);
    expect(await db.select().from(challengeFlags)).toHaveLength(0);
    const rows = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.eventType, "FLAG_RAISED"));
    expect(rows).toHaveLength(1);
    expect((await getBoard(who.acc)).unmatchedFlags).toHaveLength(1);
  });

  it("US-18: SA (case owner) cannot resolve flag — refused and logged", async () => {
    await flag(who.emp);
    const [f] = await db.select().from(challengeFlags);
    await expect(
      resolveFlag(who.sa, { flagId: f!.id, resolution: "Looks fine to me." }),
    ).rejects.toBeInstanceOf(Forbidden);
    const refused = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.eventType, "REFUSED"));
    expect(refused).toHaveLength(1);
    const [after] = await db.select().from(challengeFlags);
    expect(after!.status).toBe("open");
  });

  it("US-18: CISO cannot resolve", async () => {
    await flag(who.emp);
    const [f] = await db.select().from(challengeFlags);
    await expect(
      resolveFlag(who.ciso, { flagId: f!.id, resolution: "Dismissed it." }),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("IA resolves flag; a second resolve is a Conflict", async () => {
    await flag(who.emp);
    const [f] = await db.select().from(challengeFlags);
    await resolveFlag(who.ia, {
      flagId: f!.id,
      resolution: "Reviewed; escalated.",
    });
    const [after] = await db.select().from(challengeFlags);
    expect(after).toMatchObject({
      status: "resolved",
      resolvedBy: who.ia.id,
      resolution: "Reviewed; escalated.",
    });
    await expect(
      resolveFlag(who.acc, { flagId: f!.id, resolution: "Again again." }),
    ).rejects.toBeInstanceOf(Conflict);
    expect((await verifyChain()).ok).toBe(true);
  });

  it("unique (case_id, reason_key): double-submitted flag form creates two flags but each Tier 2 exactly once", async () => {
    await Promise.all([flag(who.emp), flag(who.emp)]);
    const flags = await db.select().from(challengeFlags);
    expect(flags).toHaveLength(2);
    const t2 = await db.select().from(boardItems).where(eq(boardItems.tier, 2));
    expect(t2.map((r) => r.reasonKey).sort()).toEqual(
      flags.map((f) => `flag:${f.id}`).sort(),
    );
  });

  it("flag text is validated", async () => {
    await expect(
      raiseFlag(who.emp, { caseRef: "CASE-0001", text: "no" }),
    ).rejects.toThrow();
  });
});
