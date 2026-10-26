import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/domain/types";
import { db } from "@/server/db/client";
import { ledgerEntries, ledgerHead, rulePacks } from "@/server/db/schema";
import { Forbidden, ValidationError } from "@/server/errors";
import { writeGenesis } from "@/server/ledger/genesis";
import { verifyChain } from "@/server/ledger/verify";
import { runCommand, type CommandDef } from "@/server/run-command";
import { ownerPool, resetTestDb } from "./setup/db";

const SA: Actor = { id: "sa-1", role: "SA", displayName: "SA" };
const GC: Actor = { id: "gc-1", role: "GC", displayName: "GC" };
const emptySchema = z.strictObject({});

async function ledger() {
  return db.select().from(ledgerEntries).orderBy(ledgerEntries.seq);
}
async function stateRows() {
  return db.select().from(rulePacks);
}

const writePack = (ctxTx: typeof db, version: string) =>
  ctxTx
    .insert(rulePacks)
    .values({ version, body: {}, publishedAt: new Date() });

describe("runCommand", () => {
  beforeEach(async () => {
    await resetTestDb();
    await db.transaction((tx) =>
      writeGenesis(tx, "2026-10-27T00:00:00.000Z", "v1"),
    );
  });
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });

  it("US-01: refused command writes REFUSED entry and throws Forbidden", async () => {
    let ran = false;
    const def: CommandDef<object, void> = {
      action: "submitDecision",
      schema: emptySchema,
      handler: async () => {
        ran = true;
      },
    };
    await expect(runCommand(def, SA, {})).rejects.toThrow(Forbidden);
    expect(ran).toBe(false);
    const rows = await ledger();
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      eventType: "REFUSED",
      actorId: "sa-1",
      payload: {
        action: "submitDecision",
        reason: "role SA may not submitDecision",
        actorRole: "SA",
      },
    });
    expect((await verifyChain()).ok).toBe(true);
  });

  it("a signed-out caller is refused and logged with a null actor", async () => {
    const def: CommandDef<object, void> = {
      action: "raiseFlag",
      schema: emptySchema,
      handler: async () => {},
    };
    await expect(runCommand(def, null, {})).rejects.toThrow(/not signed in/);
    expect((await ledger())[1]).toMatchObject({
      eventType: "REFUSED",
      actorId: null,
      payload: {
        action: "raiseFlag",
        reason: "not signed in",
        actorRole: null,
      },
    });
  });

  it("US-11: closeCase is refused for every actor, including the one who would be the case owner", async () => {
    const def: CommandDef<object, void> = {
      action: "closeCase",
      schema: emptySchema,
      handler: async () => {},
    };
    for (const actor of [SA, GC])
      await expect(runCommand(def, actor, {})).rejects.toThrow(Forbidden);
    expect((await ledger()).map((r) => r.eventType)).toEqual([
      "GENESIS",
      "REFUSED",
      "REFUSED",
    ]);
  });

  it("Forbidden thrown inside handler rolls back state but persists REFUSED", async () => {
    const def: CommandDef<object, void> = {
      action: "submitDecision",
      schema: emptySchema,
      handler: async ({ tx, log }) => {
        await writePack(tx as unknown as typeof db, "v-leak");
        await log("DECISION_SUBMITTED", { leaked: true });
        throw new Forbidden("approver is not independent");
      },
    };
    await expect(runCommand(def, GC, {})).rejects.toThrow(
      "approver is not independent",
    );
    expect(await stateRows()).toHaveLength(0);
    const rows = await ledger();
    expect(rows.map((r) => r.eventType)).toEqual(["GENESIS", "REFUSED"]);
    expect(rows[1]).toMatchObject({
      actorId: "gc-1",
      payload: {
        action: "submitDecision",
        reason: "approver is not independent",
        actorRole: "GC",
      },
    });
    expect((await verifyChain()).ok).toBe(true);
  });

  it("handler error rolls back state and ledger", async () => {
    const [headBefore] = await db.select().from(ledgerHead);
    const def: CommandDef<object, void> = {
      action: "declareIncident",
      schema: emptySchema,
      handler: async ({ tx, log }) => {
        await writePack(tx as unknown as typeof db, "v-leak");
        await log("INCIDENT_DECLARED", { x: 1 });
        throw new Error("boom");
      },
    };
    await expect(runCommand(def, SA, {})).rejects.toThrow("boom");
    expect(await stateRows()).toHaveLength(0);
    expect(await ledger()).toHaveLength(1);
    expect((await db.select().from(ledgerHead))[0]).toEqual(headBefore);
  });

  it("invalid input throws ValidationError and logs nothing", async () => {
    const def: CommandDef<{ n: number }, void> = {
      action: "declareIncident",
      schema: z.strictObject({ n: z.number().int() }),
      handler: async () => {},
    };
    await expect(runCommand(def, SA, { n: "x" })).rejects.toThrow(
      ValidationError,
    );
    // Even a forbidden role with bad input is a validation error first (spec §3 step 1).
    await expect(
      runCommand(def, { ...SA, role: "ACC" }, { n: 1.5 }),
    ).rejects.toThrow(ValidationError);
    expect(await ledger()).toHaveLength(1);
  });

  it("success: handler state and its ledger entries commit together, actor and time from ctx", async () => {
    const def: CommandDef<{ v: string }, string> = {
      action: "declareIncident",
      schema: z.strictObject({ v: z.string() }),
      handler: async ({ tx, log, nowIso, actor }, { v }) => {
        await writePack(tx as unknown as typeof db, v);
        await log("INCIDENT_DECLARED", { v, by: actor.id });
        await log("CASE_CREATED", { v }, { actorId: null });
        expect(nowIso).toMatch(/^\d{4}-\d\d-\d\dT[\d:.]+Z$/);
        return "done";
      },
    };
    expect(await runCommand(def, SA, { v: "p1" })).toBe("done");
    expect(await stateRows()).toHaveLength(1);
    const rows = await ledger();
    expect(rows.map((r) => [r.eventType, r.actorId])).toEqual([
      ["GENESIS", null],
      ["INCIDENT_DECLARED", "sa-1"],
      ["CASE_CREATED", null],
    ]);
    expect((await verifyChain()).ok).toBe(true);
  });

  it("20 concurrent commands keep the chain intact", async () => {
    const def: CommandDef<{ i: number }, void> = {
      action: "declareIncident",
      schema: z.strictObject({ i: z.number().int() }),
      handler: async ({ log }, { i }) => log("INCIDENT_DECLARED", { i }),
    };
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => runCommand(def, SA, { i })),
    );
    expect(await verifyChain()).toMatchObject({ ok: true, count: 21 });
  });

  it("clock: demo offset applies only when DEMO_MODE=true", async () => {
    await ownerPool.query(
      "UPDATE demo_settings SET offset_ms = 3600000 WHERE id = 1",
    );
    const seen: number[] = [];
    const def: CommandDef<object, void> = {
      action: "declareIncident",
      schema: emptySchema,
      handler: async ({ now }) => {
        seen.push(now.getTime() - Date.now());
      },
    };
    await runCommand(def, SA, {});
    process.env.DEMO_MODE = "true";
    await runCommand(def, SA, {});
    expect(Math.abs(seen[0]!)).toBeLessThan(5_000);
    expect(Math.abs(seen[1]! - 3_600_000)).toBeLessThan(5_000);
  });
});
