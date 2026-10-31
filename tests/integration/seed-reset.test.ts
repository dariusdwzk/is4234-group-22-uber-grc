import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hoursToIso } from "@/domain/demo-time";
import { db } from "@/server/db/client";
import {
  cases,
  externalAnchors,
  ledgerEntries,
  signals,
} from "@/server/db/schema";
import { advanceClock } from "@/server/commands/advance-clock";
import { resetDemo } from "@/server/commands/reset-demo";
import { getNow } from "@/server/clock";
import { NotFound, ValidationError } from "@/server/errors";
import { verifyChain } from "@/server/ledger/verify";
import { listLedger } from "@/server/queries/ledger";
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

  it("seeds the mockup's low-risk history, then Day 0 opens C-104; the ledger is intact and anchored", async () => {
    expect(await getNow()).toBe(0);
    const cs = await db.select().from(cases).orderBy(cases.id);
    expect(cs.map((c) => [c.id, c.severity, c.status])).toEqual([
      ["C-101", "LOW", "Logged"],
      ["C-102", "LOW", "Logged"],
      ["C-103", "LOW", "Logged"],
      ["C-104", "HIGH", "Open"],
    ]);
    expect((await db.select().from(signals)).map((s) => s.id).sort()).toEqual([
      "SIG-101",
      "SIG-102",
      "SIG-104",
      "SIG-201",
    ]);

    const rows = await db
      .select()
      .from(ledgerEntries)
      .orderBy(ledgerEntries.seq);
    expect(
      rows.slice(0, 7).map((r) => [r.eventType, r.actorId, r.payload]),
    ).toEqual([
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
      [
        "Classified LOW",
        "System",
        {
          caseId: "C-102",
          detail: "No high-risk rule fired. Logged without approval.",
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
    expect(
      rows.slice(7).map((r) => [r.eventType, r.actorId, r.payload]),
    ).toEqual([
      [
        "Signal received",
        "Cloud monitoring",
        { caseId: "", detail: "SIG-201: mass download" },
      ],
      [
        "Case opened automatically",
        "System",
        { caseId: "C-104", detail: "From SIG-201. No one had to declare it." },
      ],
      [
        "Classified HIGH",
        "System",
        { caseId: "C-104", detail: "Rules fired: R1, R6, R8." },
      ],
      [
        "Deadlines started",
        "System",
        { caseId: "C-104", detail: "GDPR and internal clocks running." },
      ],
      [
        "Board notice sent (Tier 1)",
        "System",
        {
          caseId: "C-104",
          detail:
            "New high-risk incident C-104: mass download of rider and driver data. About 57 million records affected. FTC inquiry still open. GDPR deadline Thu 19 Nov, 17:00.",
        },
      ],
    ]);
    expect(await db.select().from(externalAnchors)).toMatchObject([
      { seq: 7, reason: "Daily export", createdH: 0 },
      { seq: 12, reason: "After board notice", createdH: 0 },
    ]);
    expect(await verifyChain()).toMatchObject({
      ok: true,
      count: 12,
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
    expect(await verifyChain()).toMatchObject({ ok: true, count: 12 });
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

  it("each clock move writes a daily anchor that the integrity check compares", async () => {
    await advanceClock(null, { hours: 24 });
    const anchors = await db
      .select()
      .from(externalAnchors)
      .orderBy(externalAnchors.id);
    expect(anchors.map((a) => [a.reason, a.createdH])).toEqual([
      ["Daily export", 0],
      ["After board notice", 0],
      ["Daily export", 24],
    ]);
    expect(await verifyChain()).toMatchObject({ ok: true, anchorsOk: true });
  });

  it("listLedger shapes entries like the mockup's ledger, without GENESIS", async () => {
    const view = await listLedger();
    expect(view).toHaveLength(11);
    expect(view[0]).toMatchObject({
      seq: 2,
      t: -50,
      actor: "Cloud monitoring",
      action: "Signal received",
      caseId: "C-101",
      detail: "SIG-101",
    });
    expect(view[0]!.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("DEMO_MODE off: reset and clock 404, and the demo connection is never opened", async () => {
    delete process.env.DEMO_MODE;
    delete demoGlobal.__grcDemoDb;
    await expect(resetDemo()).rejects.toThrow(NotFound);
    await expect(advanceClock(null, { hours: 24 })).rejects.toThrow(NotFound);
    expect(demoGlobal.__grcDemoDb).toBeUndefined();
  });
});
