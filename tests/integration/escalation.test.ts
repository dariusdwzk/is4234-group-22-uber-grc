import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/domain/types";
import { db } from "@/server/db/client";
import { boardItems, ledgerEntries } from "@/server/db/schema";
import { advanceClock } from "@/server/commands/advance-clock";
import { ingestEvent } from "@/server/commands/ingest-event";
import { submitDecision } from "@/server/commands/submit-decision";
import { seed } from "@/server/seed/seed";
import { SEED_USERS, type SeedKey } from "@/server/seed/users";
import { ownerDb, resetTestDb } from "./setup/db";

const DEMO: Actor = { id: "demo-1", role: "DEMO", displayName: "Demo" };
const checklist = {
  reviewedEvidence: true,
  noPersonalConflict: true,
  consideredRegulatorDeadlines: true,
  consideredBoardNotice: true,
  notInstructedBySecurity: true,
};
let who: Record<SeedKey, Actor>;

const ingest = (kind: string, payload: unknown, key: string) =>
  ingestEvent(DEMO, {
    kind,
    occurredAt: new Date().toISOString(),
    correlationKey: key,
    payload,
  });
const highAlert = () =>
  ingest(
    "cloud_download_alert",
    {
      resource: "s3://synthetic-bucket",
      records: 1000,
      containsPersonalData: true,
      affectedJurisdictions: ["US"],
    },
    "K1",
  );
const tier2 = async () =>
  (await db.select().from(boardItems).where(eq(boardItems.tier, 2)))
    .map((b) => b.reasonKey)
    .sort();
// advanceClock is itself a command, so the sweep runs at the start of the NEXT one.
const advance = (h: number) => advanceClock(DEMO, { hours: h });

describe("escalation sweep", () => {
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
  });
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });

  it("US-19: GDPR clock at 75% creates one Tier 2", async () => {
    await highAlert();
    await advance(54);
    expect(await tier2()).toEqual([]); // sweep has not run since the clock moved
    await advance(1);
    expect((await tier2()).filter((k) => k === "clock:GDPR_33")).toHaveLength(
      1,
    );
  });

  it("US-19: sweeping twice creates it exactly once", async () => {
    await highAlert();
    await advance(60);
    await advance(1);
    const first = await tier2();
    await advance(1);
    await advance(1);
    expect(await tier2()).toEqual(first);
    expect(first.filter((k) => k === "clock:GDPR_33")).toHaveLength(1);
  });

  it("a case classified at intake does not breach the classify SLA", async () => {
    await highAlert();
    await advance(60);
    await advance(1);
    expect(await tier2()).not.toContain("clock:INT_CLASSIFY");
  });

  it("agreed case does not escalate", async () => {
    await highAlert();
    for (const k of ["gc", "pco"] as const)
      await submitDecision(who[k], {
        caseId: (await db.select().from(boardItems))[0]!.caseId,
        outcome: "withhold",
        reasonCode: "LEGAL_ADVICE",
        checklist,
      });
    await advance(100);
    await advance(1);
    expect(await tier2()).toEqual([]);
  });

  it("LOW case does not escalate", async () => {
    await ingest("blocked_login", { account: "svc-test" }, "K2");
    await advance(100);
    await advance(1);
    expect(await db.select().from(boardItems)).toHaveLength(0);
  });

  it("advanceClock +60h triggers escalation on next command", async () => {
    await highAlert();
    await advance(60);
    await ingest("blocked_login", { account: "svc-test" }, "K3");
    expect(await tier2()).toContain("clock:GDPR_33");
  });

  it("US-19: automatic escalations are attributed to the system actor, not whoever triggered the sweep", async () => {
    await highAlert();
    await advance(60);
    await ingest("blocked_login", { account: "svc-test" }, "K3");
    const rows = (
      await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.eventType, "TIER2_CREATED"))
    ).filter((r) => JSON.stringify(r.payload).includes("clock:"));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.actorId).toBe("system");
  });

  it("US-19: concurrent agreeing decisions plus a sweeping command all succeed (no deadlock)", async () => {
    for (let i = 0; i < 5; i++) {
      await resetTestDb();
      const ids = await ownerDb.transaction((tx) =>
        seed(tx, { demoPassword: "demo-password-12345", now: new Date() }),
      );
      const gc = { ...who.gc, id: ids.gc! };
      const pco = { ...who.pco, id: ids.pco! };
      await highAlert();
      const caseId = (await db.select().from(boardItems))[0]!.caseId;
      await advance(53);
      const d = {
        caseId,
        outcome: "withhold",
        reasonCode: "LEGAL_ADVICE",
        checklist,
      };
      const results = await Promise.allSettled([
        submitDecision(gc, d),
        submitDecision(pco, d),
        advance(2),
        ingest("blocked_login", { account: "svc-test" }, `K${i}`),
      ]);
      expect(results.filter((r) => r.status === "rejected")).toEqual([]);
    }
  });
});
