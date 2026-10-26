import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/domain/types";
import { db } from "@/server/db/client";
import {
  boardItems,
  cases,
  intakeEvents,
  ledgerEntries,
  ruleEvaluations,
} from "@/server/db/schema";
import { declareIncident } from "@/server/commands/declare-incident";
import { ingestEvent } from "@/server/commands/ingest-event";
import { Forbidden, ValidationError } from "@/server/errors";
import { writeGenesis } from "@/server/ledger/genesis";
import { verifyChain } from "@/server/ledger/verify";
import { resetTestDb, seedUser } from "./setup/db";

const DEMO: Actor = { id: "demo-1", role: "DEMO", displayName: "Demo" };
const SA: Actor = { id: "sa-1", role: "SA", displayName: "SA" };
let emp: Actor;

const t = (h: number) => `2026-11-01T0${h}:00:00.000Z`;
const alert = {
  resource: "s3://synthetic-backup-bucket",
  records: 1000,
  containsPersonalData: true,
  affectedJurisdictions: ["US"],
};
const payment = {
  amountCents: 10_000_000,
  payee: "anon-reporter-01",
  payeeVerified: false,
  label: "bug bounty",
  linkedToIncident: true,
};
const bounty = {
  reporterHandle: "anon-reporter-01",
  amountCents: 10_000_000,
  payeeVerified: false,
  label: "bug bounty",
  text: "pay us",
};

const ingest = (
  kind: string,
  payload: unknown,
  key: string,
  hour = 1,
  actor: Actor | null = DEMO,
) =>
  ingestEvent(actor, {
    kind,
    occurredAt: t(hour),
    correlationKey: key,
    payload,
  });

async function allCases() {
  return db.select().from(cases).orderBy(cases.ref);
}

describe("intake", () => {
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });
  beforeEach(async () => {
    process.env.DEMO_MODE = "true"; // the simulator only exists in demo mode
    await resetTestDb();
    await db.transaction((tx) =>
      writeGenesis(tx, "2026-10-27T00:00:00.000Z", "v1"),
    );
    emp = await seedUser({
      email: "emp@demo.test",
      role: "EMP",
      passwordHash: "x",
    });
  });

  it("US-03: ingested bounty report is stored and appears in the ledger", async () => {
    await ingest("bounty_report", bounty, "K1");
    const events = await db.select().from(intakeEvents);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "bounty_report", payload: bounty });
    const types = (await db.select().from(ledgerEntries)).map(
      (r) => r.eventType,
    );
    expect(types).toContain("EVENT_INGESTED");
    expect((await verifyChain()).ok).toBe(true);
  });

  it("US-04: declaration creates case with source manual and declarant recorded; returns receipt only", async () => {
    const res = await declareIncident(emp, {
      description: "Someone demanded payment",
    });
    expect(Object.keys(res)).toEqual(["receiptId"]);
    const [c] = await allCases();
    expect(c).toMatchObject({ source: "manual", declaredBy: emp.id });
    expect(JSON.stringify(res)).not.toContain(c!.ref);
    expect(JSON.stringify(res)).not.toContain(c!.id);
    const [ev] = await db.select().from(intakeEvents);
    expect(ev!.id).toBe(res.receiptId);
  });

  it("US-05: download alert and payment request with same key attach to one case", async () => {
    await ingest("cloud_download_alert", alert, "K1", 1);
    await ingest("payment_request", payment, "K1", 2);
    expect(await allCases()).toHaveLength(1);
    expect(await db.select().from(intakeEvents)).toHaveLength(2);
  });

  it("US-05: different keys create two cases", async () => {
    await ingest("cloud_download_alert", alert, "K1");
    await ingest("cloud_download_alert", alert, "K2");
    expect((await allCases()).map((c) => c.ref)).toEqual([
      "CASE-0001",
      "CASE-0002",
    ]);
  });

  it("US-06: blocked login only → LOW and auto_closed", async () => {
    await ingest("blocked_login", { account: "svc-batch" }, "LOW-1");
    const [c] = await allCases();
    expect(c).toMatchObject({ tier: "LOW", status: "auto_closed" });
  });

  it("tier only rises: HIGH case receiving a benign event stays HIGH", async () => {
    await ingest("cloud_download_alert", alert, "K1", 1);
    await ingest("blocked_login", { account: "svc-batch" }, "K1", 2);
    const [c] = await allCases();
    expect(c).toMatchObject({ tier: "HIGH", status: "open" });
  });

  it("auto_closed LOW case reopened and raised to HIGH by a later payment event", async () => {
    await ingest("blocked_login", { account: "svc-batch" }, "K1", 1);
    await ingest("payment_request", payment, "K1", 2);
    const [c] = await allCases();
    expect(c).toMatchObject({ tier: "HIGH", status: "open" });
    expect(await allCases()).toHaveLength(1);
    const types = (await db.select().from(ledgerEntries)).map(
      (r) => r.eventType,
    );
    expect(types).toContain("CASE_REOPENED");
  });

  it("US-16: case becoming HIGH creates exactly one Tier 1 in the same transaction", async () => {
    await ingest("cloud_download_alert", alert, "K1", 1);
    await ingest("payment_request", payment, "K1", 2);
    const items = await db.select().from(boardItems);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      tier: 1,
      reasonKey: "tier1",
      status: "open",
    });
    expect(items[0]!.body).toContain("CASE-0001");
    expect(
      items[0]!.body.endsWith("Read-only notice — no action required."),
    ).toBe(true);
    const [c] = await allCases();
    expect(c!.highSince).not.toBeNull();
    const evals = await db
      .select()
      .from(ruleEvaluations)
      .where(eq(ruleEvaluations.caseId, c!.id));
    expect(evals.at(-1)!.firedRuleIds).toEqual(
      expect.arrayContaining(["R-PII", "R-PAY-LINKED", "R-PAYEE", "R-CAP"]),
    );
    const types = (await db.select().from(ledgerEntries)).map(
      (r) => r.eventType,
    );
    expect(types.filter((x) => x === "TIER1_CREATED")).toHaveLength(1);
  });

  it("ingestEvent refused for SA (simulator is DEMO-only)", async () => {
    await expect(
      ingest("blocked_login", { account: "a" }, "K1", 1, SA),
    ).rejects.toThrow(Forbidden);
    expect(await allCases()).toHaveLength(0);
    const last = (await db.select().from(ledgerEntries)).at(-1);
    expect(last!.eventType).toBe("REFUSED");
  });

  it("payload failing its kind schema → ValidationError, nothing written", async () => {
    const before = await db.select().from(ledgerEntries);
    await expect(
      ingest("payment_request", { amountCents: -1 }, "K1"),
    ).rejects.toThrow(ValidationError);
    expect(await allCases()).toHaveLength(0);
    expect(await db.select().from(intakeEvents)).toHaveLength(0);
    expect(await db.select().from(ledgerEntries)).toHaveLength(before.length);
  });

  it("a declaration with a related reference joins the case with that correlation key", async () => {
    await ingest("cloud_download_alert", alert, "REPLAY-2016");
    await declareIncident(emp, {
      description: "demand",
      relatedReference: "REPLAY-2016",
    });
    expect(await allCases()).toHaveLength(1);
    expect(await db.select().from(intakeEvents)).toHaveLength(2);
  });
});
