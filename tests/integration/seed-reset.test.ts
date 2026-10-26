import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/domain/types";
import { db } from "@/server/db/client";
import {
  cases,
  demoSettings,
  headExports,
  ledgerEntries,
  rulePacks,
  users,
} from "@/server/db/schema";
import { Forbidden, NotFound } from "@/server/errors";
import { verifyChain } from "@/server/ledger/verify";
import { resetDemo } from "@/server/commands/reset-demo";
import { seed } from "@/server/seed/seed";
import { SEED_USERS } from "@/server/seed/users";
import { ownerDb, resetTestDb } from "./setup/db";

const PASSWORD = "demo-password-12345";
const DEMO: Actor = { id: "demo-old", role: "DEMO", displayName: "Demo" };

async function ledger() {
  return db.select().from(ledgerEntries).orderBy(ledgerEntries.seq);
}

describe("seed and resetDemo", () => {
  beforeEach(async () => {
    await resetTestDb();
    process.env.DEMO_MODE = "true";
  });
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });

  it("US-02: reset clears cases, seeds users and rule pack v1, ledger starts with genesis, verify OK", async () => {
    await ownerDb.transaction((tx) =>
      seed(tx, { demoPassword: PASSWORD, now: new Date() }),
    );
    const [u] = await db.select().from(users).limit(1);
    await ownerDb.insert(cases).values({
      ref: "CASE-0001",
      correlationKey: "k",
      source: "manual",
      detectedAt: new Date(),
      declaredBy: u!.id,
    });

    await resetDemo(DEMO, PASSWORD);

    expect(await db.select().from(cases)).toHaveLength(0);
    const seeded = await db.select().from(users);
    expect(seeded.map((r) => r.email).sort()).toEqual(
      Object.values(SEED_USERS)
        .map((s) => s.email)
        .sort(),
    );
    expect((await db.select().from(rulePacks)).map((r) => r.version)).toEqual([
      "v1",
    ]);
    const rows = await ledger();
    expect(rows.map((r) => r.eventType)).toEqual(["GENESIS", "DEMO_RESET"]);
    expect((await verifyChain()).ok).toBe(true);
    const [settings] = await db.select().from(demoSettings);
    expect(settings!.offsetMs).toBe(0);
  });

  it("reset keeps previous head in head_exports", async () => {
    await ownerDb.transaction((tx) =>
      seed(tx, { demoPassword: PASSWORD, now: new Date() }),
    );
    const before = await ledger();
    const last = before[before.length - 1]!;

    await resetDemo(DEMO, PASSWORD);
    await resetDemo(DEMO, PASSWORD);

    const exported = await db.select().from(headExports);
    expect(exported[0]).toMatchObject({
      seq: last.seq,
      hash: last.hash,
      destination: "simulated_auditor_inbox",
    });
    expect(exported).toHaveLength(2);
    const rows = await ledger();
    expect(rows[1]!.payload).toMatchObject({
      previousHead: { seq: exported[1]!.seq, hash: exported[1]!.hash },
    });
  });

  it("seed refuses short DEMO_PASSWORD", async () => {
    await expect(
      ownerDb.transaction((tx) =>
        seed(tx, { demoPassword: "short", now: new Date() }),
      ),
    ).rejects.toThrow(/at least 12/);
  });

  it("seeds the demo operator only when DEMO_MODE=true", async () => {
    delete process.env.DEMO_MODE;
    await ownerDb.transaction((tx) =>
      seed(tx, { demoPassword: PASSWORD, now: new Date() }),
    );
    const emails = (await db.select().from(users)).map((r) => r.email);
    expect(emails).not.toContain("demo@demo.test");
    expect(emails).toContain("ceo@demo.test");
  });

  it("resetDemo is refused for non-DEMO roles and 404s when DEMO_MODE is off", async () => {
    const sa: Actor = { id: "sa-1", role: "SA", displayName: "SA" };
    await expect(resetDemo(sa, PASSWORD)).rejects.toThrow(Forbidden);
    delete process.env.DEMO_MODE;
    await expect(resetDemo(DEMO, PASSWORD)).rejects.toThrow(NotFound);
  });
});
