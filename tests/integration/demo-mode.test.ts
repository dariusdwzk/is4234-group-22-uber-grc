import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/domain/types";
import { db } from "@/server/db/client";
import { cases, demoSettings, ledgerEntries } from "@/server/db/schema";
import { advanceClock } from "@/server/commands/advance-clock";
import { resetDemo } from "@/server/commands/reset-demo";
import { ingestEvent } from "@/server/commands/ingest-event";
import { firePreset } from "@/server/commands/fire-preset";
import { getNow } from "@/server/clock";
import { Forbidden, NotFound } from "@/server/errors";
import { writeGenesis } from "@/server/ledger/genesis";
import { resetTestDb, seedUser } from "./setup/db";

const DEMO: Actor = { id: "demo-1", role: "DEMO", displayName: "Demo" };
const SA: Actor = { id: "sa-1", role: "SA", displayName: "SA" };
const demoGlobal = globalThis as unknown as { __grcDemoDb?: unknown };

describe("demo mode", () => {
  beforeEach(async () => {
    await resetTestDb();
    await db.transaction((tx) =>
      writeGenesis(tx, "2026-10-27T00:00:00.000Z", "v1"),
    );
    await seedUser({ email: "emp@demo.test", role: "EMP", passwordHash: "x" });
    delete demoGlobal.__grcDemoDb;
  });
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });

  it("DEMO_MODE=false: demo actions throw NotFound, demo client never constructed", async () => {
    delete process.env.DEMO_MODE;
    await expect(advanceClock(DEMO, { hours: 1 })).rejects.toThrow(NotFound);
    await expect(resetDemo(DEMO, "demo-password-12345")).rejects.toThrow(
      NotFound,
    );
    await expect(firePreset(DEMO, "lowRiskLogin")).rejects.toThrow(NotFound);
    expect(demoGlobal.__grcDemoDb).toBeUndefined();
  });

  it("US-03: DEMO_MODE=false simulator unreachable", async () => {
    delete process.env.DEMO_MODE;
    await expect(
      ingestEvent(DEMO, {
        kind: "blocked_login",
        occurredAt: "2026-11-01T01:00:00.000Z",
        correlationKey: "K",
        payload: { account: "a" },
      }),
    ).rejects.toThrow(NotFound);
    expect(await db.select().from(cases)).toHaveLength(0);
  });

  it("advanceClock moves getNow by N hours and is logged", async () => {
    process.env.DEMO_MODE = "true";
    const before = await getNow();
    await advanceClock(DEMO, { hours: 24 });
    const after = await getNow();
    expect(after.getTime() - before.getTime()).toBeGreaterThanOrEqual(
      24 * 3600_000,
    );
    expect(after.getTime() - before.getTime()).toBeLessThan(
      24 * 3600_000 + 5_000,
    );
    const [s] = await db.select().from(demoSettings);
    expect(s!.offsetMs).toBe(24 * 3600_000);
    const last = (await db.select().from(ledgerEntries)).at(-1);
    expect(last).toMatchObject({
      eventType: "CLOCK_ADVANCED",
      payload: { hours: 24 },
    });
  });

  it("advanceClock rejects hours outside 1..168 and non-DEMO roles", async () => {
    process.env.DEMO_MODE = "true";
    await expect(advanceClock(DEMO, { hours: 0 })).rejects.toThrow();
    await expect(advanceClock(DEMO, { hours: 169 })).rejects.toThrow();
    await expect(advanceClock(SA, { hours: 1 })).rejects.toThrow(Forbidden);
  });

  it("replay presets merge into one HIGH case and the declaration runs as the seeded EMP", async () => {
    process.env.DEMO_MODE = "true";
    for (const p of [
      "declaration",
      "cloudDownloadAlert",
      "bountyReport",
      "paymentRequest",
    ] as const)
      await firePreset(DEMO, p);
    const rows = await db.select().from(cases);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ref: "CASE-0001",
      tier: "HIGH",
      source: "manual",
    });
    await expect(firePreset(SA, "regulatorInquiry")).rejects.toThrow(Forbidden);
  });
});
