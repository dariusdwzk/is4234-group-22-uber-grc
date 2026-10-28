import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hoursToIso } from "@/domain/demo-time";
import { db } from "@/server/db/client";
import {
  cases,
  externalAnchors,
  ledgerEntries,
  payments,
  signals,
} from "@/server/db/schema";
import { advanceClock } from "@/server/commands/advance-clock";
import { resetDemo } from "@/server/commands/reset-demo";
import { getNow } from "@/server/clock";
import { NotFound, ValidationError } from "@/server/errors";
import { verifyChain } from "@/server/ledger/verify";
import { ownerPool } from "./setup/db";

const demoGlobal = globalThis as unknown as { __grcDemoDb?: unknown };

describe("seed, reset and the demo clock", () => {
  beforeEach(async () => {
    process.env.DEMO_MODE = "true";
    await resetDemo();
  });
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });

  it("seeds the mockup's low-risk history at Day 0 with an intact, anchored ledger", async () => {
    expect(await getNow()).toBe(0);
    const cs = await db.select().from(cases).orderBy(cases.id);
    expect(cs.map((c) => [c.id, c.severity, c.status])).toEqual([
      ["C-101", "LOW", "Logged"],
      ["C-102", "LOW", "Logged"],
      ["C-103", "LOW", "Logged"],
    ]);
    expect((await db.select().from(signals)).map((s) => s.id).sort()).toEqual([
      "SIG-101",
      "SIG-102",
      "SIG-103",
      "SIG-104",
    ]);
    expect(await db.select().from(payments)).toMatchObject([
      {
        id: "PAY-1",
        amountCents: 300_000,
        status: "Released",
        caseId: "C-102",
      },
    ]);

    const rows = await db
      .select()
      .from(ledgerEntries)
      .orderBy(ledgerEntries.seq);
    expect(rows.map((r) => [r.eventType, r.actorId, r.payload])).toEqual([
      ["GENESIS", null, {}],
      [
        "Signal received",
        "Cloud monitoring",
        { caseId: "C-101", detail: "SIG-101" },
      ],
      [
        "Classified LOW",
        "System",
        {
          caseId: "C-101",
          detail: "No high-risk rule fired. Logged without approval.",
        },
      ],
      ["Signal received", "HackerOne", { caseId: "C-102", detail: "SIG-102" }],
      ["Signal received", "Finance", { caseId: "C-102", detail: "SIG-103" }],
      [
        "Classified LOW",
        "System",
        {
          caseId: "C-102",
          detail: "No high-risk rule fired. Logged without approval.",
        },
      ],
      [
        "Payment released",
        "Finance",
        {
          caseId: "C-102",
          detail: "US$3,000 to verified researcher. Low-risk case, no hold.",
        },
      ],
      [
        "Signal received",
        "Secret scanning",
        { caseId: "C-103", detail: "SIG-104" },
      ],
      [
        "Classified LOW",
        "System",
        {
          caseId: "C-103",
          detail: "No high-risk rule fired. Logged without approval.",
        },
      ],
    ]);
    expect(rows[1]!.tsIso).toBe(hoursToIso(-50));
    expect(await db.select().from(externalAnchors)).toMatchObject([
      { seq: 9, reason: "Daily export", createdH: 0 },
    ]);
    expect(await verifyChain()).toMatchObject({
      ok: true,
      count: 9,
      anchorsOk: true,
    });
  });

  it("reset starts the story over: clock back to Day 0, extra rows gone", async () => {
    await advanceClock(null, { hours: 24 });
    await ownerPool.query(
      `INSERT INTO signals (id, source, origin, detected_h, title, entity_keys, facts)
       VALUES ('SIG-999', 'Staff report', 'manual', 24, 't', '{}', '{}')`,
    );
    await resetDemo();
    expect(await getNow()).toBe(0);
    expect(await db.select().from(signals)).toHaveLength(4);
    expect(await verifyChain()).toMatchObject({ ok: true, count: 9 });
  });

  it("+1 day moves the clock by 24 hours for any role, or none; other steps are rejected", async () => {
    await advanceClock(null, { hours: 24 });
    await advanceClock(
      { role: "board", name: "Board (Audit Committee)" },
      { hours: 24 },
    );
    expect(await getNow()).toBe(48);
    await expect(advanceClock(null, { hours: 5 })).rejects.toThrow(
      ValidationError,
    );
  });

  it("DEMO_MODE off: reset and clock 404, and the demo connection is never opened", async () => {
    delete process.env.DEMO_MODE;
    delete demoGlobal.__grcDemoDb;
    await expect(resetDemo()).rejects.toThrow(NotFound);
    await expect(advanceClock(null, { hours: 24 })).rejects.toThrow(NotFound);
    expect(demoGlobal.__grcDemoDb).toBeUndefined();
  });
});
