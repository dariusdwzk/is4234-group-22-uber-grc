import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/domain/types";
import { db } from "@/server/db/client";
import { ledgerEntries } from "@/server/db/schema";
import { writeGenesis } from "@/server/ledger/genesis";
import { guardActor } from "@/server/page-guard";
import { resetTestDb } from "./setup/db";

const EMP: Actor = { id: "emp-1", role: "EMP", displayName: "EMP" };
const SA: Actor = { id: "sa-1", role: "SA", displayName: "SA" };

const digestOf = (e: unknown) => (e as { digest?: string }).digest ?? "";

describe("guardActor", () => {
  beforeEach(async () => {
    await resetTestDb();
    await db.transaction((tx) =>
      writeGenesis(tx, "2026-10-27T00:00:00.000Z", "v1"),
    );
  });

  it("US-01: EMP requesting a case page is refused and logged", async () => {
    const err = await guardActor(EMP, "viewCases").catch((e: unknown) => e);
    expect(digestOf(err)).toContain("404");
    const rows = await db.select().from(ledgerEntries);
    expect(rows.at(-1)).toMatchObject({
      eventType: "REFUSED",
      actorId: "emp-1",
      payload: { action: "viewCases", actorRole: "EMP" },
    });
  });

  it("no actor redirects to /login and logs nothing", async () => {
    const err = await guardActor(null, "viewCases").catch((e: unknown) => e);
    expect(digestOf(err)).toContain("NEXT_REDIRECT");
    expect(digestOf(err)).toContain("/login");
    expect(await db.select().from(ledgerEntries)).toHaveLength(1);
  });

  it("an allowed role gets its actor back", async () => {
    await expect(guardActor(SA, "viewCases")).resolves.toBe(SA);
  });
});
