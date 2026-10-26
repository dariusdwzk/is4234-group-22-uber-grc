import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/domain/types";
import { db } from "@/server/db/client";
import {
  boardItems,
  cases,
  decisions,
  ledgerEntries,
  recommendations,
} from "@/server/db/schema";
import { closeCase } from "@/server/commands/close-case";
import { ingestEvent } from "@/server/commands/ingest-event";
import { recordMateriality } from "@/server/commands/record-materiality";
import { recordRecommendation } from "@/server/commands/record-recommendation";
import { submitDecision } from "@/server/commands/submit-decision";
import { Conflict, Forbidden } from "@/server/errors";
import { verifyChain } from "@/server/ledger/verify";
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
const decide = (outcome: string, extra: object = {}) => ({
  outcome,
  reasonCode: "LEGAL_ADVICE",
  checklist,
  ...extra,
});

let who: Record<SeedKey, Actor>;
let caseId: string;

async function refusals(): Promise<string[]> {
  const rows = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.eventType, "REFUSED"));
  return rows.map((r) => JSON.stringify(r.payload));
}

describe("gate commands", () => {
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
    const at = new Date().toISOString();
    await ingestEvent(DEMO, {
      kind: "cloud_download_alert",
      occurredAt: at,
      correlationKey: "K1",
      payload: {
        resource: "s3://synthetic-bucket",
        records: 1000,
        containsPersonalData: true,
        affectedJurisdictions: ["US"],
      },
    });
    const [c] = await db.select().from(cases);
    expect(c!.tier).toBe("HIGH");
    caseId = c!.id;
  });
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });

  it("US-11: SA close on HIGH refused, names missing approvals, logged", async () => {
    const err = await closeCase(who.sa, { caseId }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Forbidden);
    expect((err as Forbidden).reason).toMatch(
      /Missing: General Counsel, Privacy\/Compliance/,
    );
    expect((await db.select().from(cases))[0]!.status).toBe("open");
    expect((await refusals()).some((r) => r.includes("closeCase"))).toBe(true);
  });

  it("US-11: CISO close on HIGH refused", async () => {
    await expect(closeCase(who.ciso, { caseId })).rejects.toBeInstanceOf(
      Forbidden,
    );
  });

  it("US-11: closing as EMP or signed-out is refused too", async () => {
    await expect(closeCase(who.emp, { caseId })).rejects.toBeInstanceOf(
      Forbidden,
    );
    await expect(closeCase(null, { caseId })).rejects.toBeInstanceOf(Forbidden);
  });

  it("closeCase on an already closed case → Conflict", async () => {
    await submitDecision(who.gc, { caseId, ...decide("withhold") });
    await submitDecision(who.pco, { caseId, ...decide("withhold") });
    await expect(closeCase(who.sa, { caseId })).rejects.toBeInstanceOf(
      Conflict,
    );
  });

  it("US-12: GC + PCO both withhold → case closed, both decisions stored with reason code and checklist", async () => {
    await submitDecision(who.gc, { caseId, ...decide("withhold") });
    await submitDecision(who.pco, { caseId, ...decide("withhold") });
    const [c] = await db.select().from(cases);
    expect(c).toMatchObject({ status: "closed", outcome: "withhold" });
    expect(c!.closedAt).not.toBeNull();
    const ds = await db.select().from(decisions);
    expect(ds).toHaveLength(2);
    expect(ds[0]).toMatchObject({ reasonCode: "LEGAL_ADVICE", checklist });
    const types = (await db.select().from(ledgerEntries)).map(
      (r) => r.eventType,
    );
    expect(types).toContain("DECISION_SUBMITTED");
    expect(types).toContain("CASE_CLOSED");
    expect((await verifyChain()).ok).toBe(true);
  });

  it("closed case keeps its Tier 1 board item", async () => {
    await submitDecision(who.gc, { caseId, ...decide("withhold") });
    await submitDecision(who.pco, { caseId, ...decide("withhold") });
    const t1 = await db
      .select()
      .from(boardItems)
      .where(and(eq(boardItems.caseId, caseId), eq(boardItems.tier, 1)));
    expect(t1).toHaveLength(1);
  });

  it("US-12: only GC → case stays open", async () => {
    await submitDecision(who.gc, { caseId, ...decide("withhold") });
    expect((await db.select().from(cases))[0]!.status).toBe("open");
  });

  it("notify_later agreed stores notify_by", async () => {
    const d = { notifyBy: "2026-11-05" };
    await submitDecision(who.gc, { caseId, ...decide("notify_later", d) });
    await submitDecision(who.pco, { caseId, ...decide("notify_later", d) });
    const [c] = await db.select().from(cases);
    expect(c!.status).toBe("closed");
    expect(c!.notifyBy?.toISOString()).toBe("2026-11-05T00:00:00.000Z");
  });

  it("US-13: pat.quinn (PCO reporting to CISO) refused 'not independent' and logged", async () => {
    const err = await submitDecision(who.pco_sec, {
      caseId,
      ...decide("withhold"),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Forbidden);
    expect((err as Forbidden).reason).toMatch(/not independent/i);
    expect(await db.select().from(decisions)).toHaveLength(0);
    expect((await refusals()).some((r) => /not independent/i.test(r))).toBe(
      true,
    );
  });

  it("US-13: incomplete checklist refused", async () => {
    await expect(
      submitDecision(who.gc, {
        caseId,
        ...decide("withhold", {
          checklist: { ...checklist, reviewedEvidence: false },
        }),
      }),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("SA cannot submit a decision", async () => {
    await expect(
      submitDecision(who.sa, { caseId, ...decide("withhold") }),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("US-15: GC withhold + PCO notify_now → Tier 2 'disagreement' created in same action", async () => {
    await submitDecision(who.gc, { caseId, ...decide("withhold") });
    await submitDecision(who.pco, { caseId, ...decide("notify_now") });
    const t2 = await db.select().from(boardItems).where(eq(boardItems.tier, 2));
    expect(t2).toHaveLength(1);
    expect(t2[0]!.reasonKey).toBe("disagreement");
    expect((await db.select().from(cases))[0]!.status).toBe("open");
    const types = (await db.select().from(ledgerEntries)).map(
      (r) => r.eventType,
    );
    expect(types).toContain("TIER2_CREATED");
  });

  it("resubmitting same decision is idempotent for Tier 2", async () => {
    await submitDecision(who.gc, { caseId, ...decide("withhold") });
    await submitDecision(who.pco, { caseId, ...decide("notify_now") });
    await submitDecision(who.pco, { caseId, ...decide("notify_now") });
    expect(
      await db.select().from(boardItems).where(eq(boardItems.tier, 2)),
    ).toHaveLength(1);
    expect(await db.select().from(decisions)).toHaveLength(2);
  });

  it("disagreement can be resolved by re-deciding → closed", async () => {
    await submitDecision(who.gc, { caseId, ...decide("withhold") });
    await submitDecision(who.pco, { caseId, ...decide("notify_now") });
    await submitDecision(who.pco, { caseId, ...decide("withhold") });
    expect((await db.select().from(cases))[0]!.status).toBe("closed");
  });

  it("submitDecision on closed case → Conflict", async () => {
    await submitDecision(who.gc, { caseId, ...decide("withhold") });
    await submitDecision(who.pco, { caseId, ...decide("withhold") });
    await expect(
      submitDecision(who.gc, { caseId, ...decide("notify_now") }),
    ).rejects.toBeInstanceOf(Conflict);
  });

  it("recordRecommendation: SA recommends; a recommendation never closes", async () => {
    await recordRecommendation(who.sa, {
      caseId,
      proposedOutcome: "withhold",
      dataTaken: "no",
      treatAs: "bug_bounty",
      text: "Looks like a bounty.",
    });
    const recs = await db.select().from(recommendations);
    expect(recs).toHaveLength(1);
    expect((await db.select().from(cases))[0]!.status).toBe("open");
    await expect(
      recordRecommendation(who.gc, {
        caseId,
        proposedOutcome: "withhold",
        dataTaken: "no",
        treatAs: "incident",
        text: "x",
      }),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it("a second recommendation on the same case → Conflict", async () => {
    const r = (text: string) => ({
      caseId,
      proposedOutcome: "withhold",
      dataTaken: "unknown",
      treatAs: "incident",
      text,
    });
    await recordRecommendation(who.sa, r("first"));
    await expect(
      recordRecommendation(who.ciso, r("second")),
    ).rejects.toBeInstanceOf(Conflict);
  });

  it("recordMateriality sets once; second call → Conflict; only GC", async () => {
    await expect(recordMateriality(who.sa, { caseId })).rejects.toBeInstanceOf(
      Forbidden,
    );
    await recordMateriality(who.gc, { caseId });
    const [c] = await db.select().from(cases);
    expect(c!.materialityDeterminedAt).not.toBeNull();
    await expect(recordMateriality(who.gc, { caseId })).rejects.toBeInstanceOf(
      Conflict,
    );
  });
});
