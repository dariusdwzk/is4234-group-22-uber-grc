import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POLICY } from "@/server/authz";
import type { Actor } from "@/domain/types";
import { db } from "@/server/db/client";
import { boardItems, cases, ledgerEntries } from "@/server/db/schema";
import { acknowledgeTier2 } from "@/server/commands/acknowledge-tier2";
import { advanceClock } from "@/server/commands/advance-clock";
import { ingestEvent } from "@/server/commands/ingest-event";
import { submitDecision } from "@/server/commands/submit-decision";
import { sweep } from "@/server/commands/sweep";
import { Conflict, Forbidden } from "@/server/errors";
import { verifyChain } from "@/server/ledger/verify";
import { getBoard } from "@/server/queries/board";
import { seed } from "@/server/seed/seed";
import { SEED_USERS, type SeedKey } from "@/server/seed/users";
import { ownerDb, resetTestDb } from "./setup/db";

let who: Record<SeedKey, Actor>;
let caseId: string;

const checklist = {
  reviewedEvidence: true,
  noPersonalConflict: true,
  consideredRegulatorDeadlines: true,
  consideredBoardNotice: true,
  notInstructedBySecurity: true,
};
const decide = (caseId: string, outcome: string) => ({
  caseId,
  outcome,
  reasonCode: "LEGAL_ADVICE",
  checklist,
});

describe("board", () => {
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
    await ingestEvent(who.demo, {
      kind: "cloud_download_alert",
      occurredAt: new Date().toISOString(),
      correlationKey: "K1",
      payload: {
        resource: "s3://synthetic-bucket",
        records: 1000,
        containsPersonalData: true,
        affectedJurisdictions: ["US"],
      },
    });
    caseId = (await db.select().from(cases))[0]!.id;
  });
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });

  async function disagree(): Promise<string> {
    await submitDecision(who.gc, decide(caseId, "notify_now"));
    await submitDecision(who.pco, decide(caseId, "withhold"));
    const [t2] = await db
      .select()
      .from(boardItems)
      .where(eq(boardItems.reasonKey, "disagreement"));
    return t2!.id;
  }

  it("US-17: ACC acknowledges Tier 2 with note → handled and logged", async () => {
    const itemId = await disagree();
    await acknowledgeTier2(who.acc, { itemId, actionNote: "Called GC and PCO." });
    const [row] = await db.select().from(boardItems).where(eq(boardItems.id, itemId));
    expect(row).toMatchObject({
      status: "acknowledged",
      ackNote: "Called GC and PCO.",
      ackBy: who.acc.id,
    });
    expect(row!.ackAt).toBeInstanceOf(Date);
    const logged = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.eventType, "TIER2_ACKNOWLEDGED"));
    expect(logged).toHaveLength(1);
    expect((await verifyChain()).ok).toBe(true);
  });

  it("US-17: second acknowledge is a Conflict", async () => {
    const itemId = await disagree();
    await acknowledgeTier2(who.acc, { itemId, actionNote: "First note." });
    await expect(
      acknowledgeTier2(who.acc, { itemId, actionNote: "Second note." }),
    ).rejects.toBeInstanceOf(Conflict);
  });

  it("US-17: GC cannot acknowledge", async () => {
    const itemId = await disagree();
    await expect(
      acknowledgeTier2(who.gc, { itemId, actionNote: "Nope nope." }),
    ).rejects.toBeInstanceOf(Forbidden);
    const [row] = await db.select().from(boardItems).where(eq(boardItems.id, itemId));
    expect(row!.status).toBe("open");
  });

  it("US-17: a note is required", async () => {
    const itemId = await disagree();
    await expect(acknowledgeTier2(who.acc, { itemId, actionNote: "x" })).rejects.toThrow();
  });

  it("US-16: Tier 1 has no edit/delete command and cannot be acknowledged", async () => {
    expect(Object.keys(POLICY).filter((a) => /tier1|editBoard|deleteBoard/i.test(a))).toEqual([]);
    const [t1] = await db.select().from(boardItems).where(eq(boardItems.reasonKey, "tier1"));
    await expect(
      acknowledgeTier2(who.acc, { itemId: t1!.id, actionNote: "Try to ack." }),
    ).rejects.toBeInstanceOf(Conflict);
    const [after] = await db.select().from(boardItems).where(eq(boardItems.id, t1!.id));
    expect(after!.status).toBe("open");
  });

  it("US-24: board query returns KPI for the replay case", async () => {
    const b = await getBoard(who.acc);
    expect(b.cases).toHaveLength(1);
    expect(b.cases[0]!.daysToBoard).toBe(0);
    expect(b.tier1).toHaveLength(1);
    expect(b.tier1[0]!.ref).toBe("CASE-0001");
    expect(b.kpiBaseline.detectionToDisclosureDays).toBe(371);
    expect(b.verify.ok).toBe(true);
  });

  it("board query is ACC only", async () => {
    await expect(getBoard(who.sa)).rejects.toBeInstanceOf(Forbidden);
    await expect(getBoard(who.gc)).rejects.toBeInstanceOf(Forbidden);
  });

  it("sweep creates the escalation Tier 2 once, as the system", async () => {
    await advanceClock(who.demo, { hours: 60 });
    // advanceClock's own sweep already ran at the old time; a viewer sweep sees the new time.
    await sweep();
    await sweep();
    const t2 = await db.select().from(boardItems).where(eq(boardItems.tier, 2));
    const keys = t2.map((r) => r.reasonKey);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
    const created = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.eventType, "TIER2_CREATED"));
    expect(created).toHaveLength(keys.length);
    expect(created.every((e) => e.actorId === "system")).toBe(true);
  });
});
