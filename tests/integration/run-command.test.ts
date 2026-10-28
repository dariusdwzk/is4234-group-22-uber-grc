import { z } from "zod";
import { beforeEach, describe, expect, it } from "vitest";
import { hoursToIso } from "@/domain/demo-time";
import type { Actor } from "@/domain/types";
import { db } from "@/server/db/client";
import { cases, ledgerEntries, ledgerHead } from "@/server/db/schema";
import { Forbidden, ValidationError } from "@/server/errors";
import { writeGenesis } from "@/server/ledger/genesis";
import { verifyChain } from "@/server/ledger/verify";
import { runCommand, type CommandDef } from "@/server/run-command";
import { defaultFacts } from "@/domain/types";
import { ownerPool, resetTestDb } from "./setup/db";

const SECURITY: Actor = { role: "security", name: "Security team" };
const CSO: Actor = { role: "cso", name: "CSO (also Deputy GC)" };
const emptySchema = z.strictObject({});

async function ledger() {
  return db.select().from(ledgerEntries).orderBy(ledgerEntries.seq);
}

const writeCase = (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  id: string,
) =>
  tx.insert(cases).values({
    id,
    title: "t",
    severity: "LOW",
    status: "Logged",
    detectedH: 0,
    facts: defaultFacts(),
  });

describe("runCommand", () => {
  beforeEach(async () => {
    await resetTestDb();
    await db.transaction((tx) => writeGenesis(tx, hoursToIso(0)));
  });

  it("a refused command writes a Blocked entry with the reason and throws Forbidden", async () => {
    let ran = false;
    const def: CommandDef<object, void> = {
      action: "vote",
      blocked: "Blocked: Approve",
      schema: emptySchema,
      handler: async () => {
        ran = true;
      },
    };
    await expect(runCommand(def, CSO, {}, "C-104")).rejects.toThrow(Forbidden);
    expect(ran).toBe(false);
    const rows = await ledger();
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      eventType: "Blocked: Approve",
      actorId: "CSO (also Deputy GC)",
      payload: {
        caseId: "C-104",
        detail: "CSO (also Deputy GC) may not vote.",
      },
    });
    expect((await verifyChain()).ok).toBe(true);
  });

  it("a request with no role is refused and logged", async () => {
    const def: CommandDef<object, void> = {
      action: "reportIncident",
      blocked: "Blocked: Report incident",
      schema: emptySchema,
      handler: async () => {},
    };
    await expect(runCommand(def, null, {})).rejects.toThrow(/Choose a role/);
    expect((await ledger())[1]).toMatchObject({
      eventType: "Blocked: Report incident",
      actorId: "Unknown",
    });
  });

  it("closeCase is refused for every role", async () => {
    const def: CommandDef<object, void> = {
      action: "closeCase",
      blocked: "Blocked: Close case",
      schema: emptySchema,
      handler: async () => {},
    };
    for (const actor of [SECURITY, CSO])
      await expect(runCommand(def, actor, {})).rejects.toThrow(Forbidden);
    expect((await ledger()).map((r) => r.eventType)).toEqual([
      "GENESIS",
      "Blocked: Close case",
      "Blocked: Close case",
    ]);
  });

  it("Forbidden thrown inside the handler rolls back state but persists the Blocked entry", async () => {
    const def: CommandDef<object, void> = {
      action: "recommend",
      blocked: "Blocked: Recommend",
      schema: emptySchema,
      handler: async ({ tx, log }) => {
        await writeCase(tx, "C-leak");
        await log("Recommendation sent", "C-leak", "leaked");
        throw new Forbidden("already recommended");
      },
    };
    await expect(runCommand(def, CSO, {}, "C-leak")).rejects.toThrow(
      "already recommended",
    );
    expect(await db.select().from(cases)).toHaveLength(0);
    const rows = await ledger();
    expect(rows.map((r) => r.eventType)).toEqual([
      "GENESIS",
      "Blocked: Recommend",
    ]);
    expect((await verifyChain()).ok).toBe(true);
  });

  it("handler error rolls back state and ledger", async () => {
    const [headBefore] = await db.select().from(ledgerHead);
    const def: CommandDef<object, void> = {
      action: "declareIncident",
      blocked: "Blocked: Declare incident",
      schema: emptySchema,
      handler: async ({ tx, log }) => {
        await writeCase(tx, "C-leak");
        await log("Incident declared", null, "SIG-1");
        throw new Error("boom");
      },
    };
    await expect(runCommand(def, SECURITY, {})).rejects.toThrow("boom");
    expect(await db.select().from(cases)).toHaveLength(0);
    expect(await ledger()).toHaveLength(1);
    expect((await db.select().from(ledgerHead))[0]).toEqual(headBefore);
  });

  it("invalid input throws ValidationError and logs nothing, even for a forbidden role", async () => {
    const def: CommandDef<{ n: number }, void> = {
      action: "declareIncident",
      blocked: "Blocked: Declare incident",
      schema: z.strictObject({ n: z.number().int() }),
      handler: async () => {},
    };
    await expect(runCommand(def, SECURITY, { n: "x" })).rejects.toThrow(
      ValidationError,
    );
    await expect(
      runCommand(
        def,
        { role: "board", name: "Board (Audit Committee)" },
        { n: 1.5 },
      ),
    ).rejects.toThrow(ValidationError);
    expect(await ledger()).toHaveLength(1);
  });

  it("success: state and ledger entries commit together; actor, time and overrides from ctx", async () => {
    await ownerPool.query("UPDATE settings SET clock_h = 30 WHERE id = 1");
    const def: CommandDef<{ id: string }, string> = {
      action: "declareIncident",
      blocked: "Blocked: Declare incident",
      schema: z.strictObject({ id: z.string() }),
      handler: async ({ tx, log, now }, { id }) => {
        await writeCase(tx, id);
        await log("Incident declared", null, "SIG-202");
        await log("Case opened automatically", id, "From SIG-202.", {
          actor: "System",
          t: now - 2,
        });
        return "done";
      },
    };
    expect(await runCommand(def, SECURITY, { id: "C-104" })).toBe("done");
    expect(await db.select().from(cases)).toHaveLength(1);
    const rows = await ledger();
    expect(rows.slice(1).map((r) => [r.eventType, r.actorId, r.tsIso])).toEqual(
      [
        ["Incident declared", "Security team", hoursToIso(30)],
        ["Case opened automatically", "System", hoursToIso(28)],
      ],
    );
    expect((await verifyChain()).ok).toBe(true);
  });

  it("20 concurrent commands keep the chain intact", async () => {
    const def: CommandDef<{ i: number }, void> = {
      action: "declareIncident",
      blocked: "Blocked: Declare incident",
      schema: z.strictObject({ i: z.number().int() }),
      handler: async ({ log }, { i }) =>
        log("Incident declared", null, String(i)),
    };
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => runCommand(def, SECURITY, { i })),
    );
    expect(await verifyChain()).toMatchObject({ ok: true, count: 21 });
  });
});
