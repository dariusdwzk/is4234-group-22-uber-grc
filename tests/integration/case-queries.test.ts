import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/domain/types";
import { db } from "@/server/db/client";
import { ledgerEntries } from "@/server/db/schema";
import { firePreset } from "@/server/commands/fire-preset";
import { Forbidden, NotFound } from "@/server/errors";
import { writeGenesis } from "@/server/ledger/genesis";
import { getCaseDetail, listCases } from "@/server/queries/cases";
import { resetTestDb, seedUser } from "./setup/db";

const DEMO: Actor = { id: "demo-1", role: "DEMO", displayName: "Demo" };
const SA: Actor = { id: "sa-1", role: "SA", displayName: "SA" };
let emp: Actor;

describe("case queries", () => {
  beforeEach(async () => {
    process.env.DEMO_MODE = "true";
    await resetTestDb();
    await db.transaction((tx) =>
      writeGenesis(tx, "2026-10-27T00:00:00.000Z", "v1"),
    );
    emp = await seedUser({
      email: "emp@demo.test",
      role: "EMP",
      passwordHash: "x",
    });
    for (const p of [
      "declaration",
      "cloudDownloadAlert",
      "paymentRequest",
    ] as const)
      await firePreset(DEMO, p);
  });
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });

  it("US-01: EMP cannot list cases", async () => {
    await expect(listCases(emp)).rejects.toThrow(Forbidden);
    await expect(listCases(null)).rejects.toThrow(Forbidden);
    const last = (await db.select().from(ledgerEntries)).at(-1);
    expect(last).toMatchObject({ eventType: "REFUSED", actorId: null });
  });

  it("lists the merged case with its latest fired rules", async () => {
    const list = await listCases(SA);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      ref: "CASE-0001",
      tier: "HIGH",
      status: "open",
      source: "manual",
      hasOpenFlag: false,
    });
    expect(list[0]!.firedRuleIds).toEqual(
      expect.arrayContaining(["R-PII", "R-PAY-LINKED"]),
    );
  });

  it("case detail includes fired rule ids and Tier 1 body", async () => {
    const [item] = await listCases(SA);
    const d = await getCaseDetail(SA, item!.id);
    expect(d.events).toHaveLength(3);
    expect(d.evaluations.at(-1)!.firedRuleIds).toEqual(
      expect.arrayContaining(item!.firedRuleIds),
    );
    expect(d.tier1!.body).toContain("CASE-0001");
    expect(d.tier1!.body).toContain("R-PII");
    await expect(getCaseDetail(emp, item!.id)).rejects.toThrow(Forbidden);
    await expect(
      getCaseDetail(SA, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(NotFound);
    await expect(getCaseDetail(SA, "not-a-uuid")).rejects.toThrow(NotFound);
  });
});
