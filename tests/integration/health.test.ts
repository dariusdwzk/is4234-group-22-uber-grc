import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { GET as verify } from "@/app/api/ledger/verify/route";
import { db } from "@/server/db/client";
import { appendEntry } from "@/server/ledger/append";
import { writeGenesis } from "@/server/ledger/genesis";
import { demoPool, resetTestDb } from "./setup/db";

// connection() only works inside a Next request scope; the handlers themselves are plain functions.
vi.mock("next/server", () => ({ connection: async () => {} }));

describe("health and verify endpoints", () => {
  beforeEach(async () => {
    await resetTestDb();
    await db.transaction((tx) =>
      writeGenesis(tx, "2026-10-27T00:00:00.000Z", "v1"),
    );
  });

  it("health ok when DB reachable", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", db: "ok" });
  });

  it("verify route returns {ok:true,count,headHash}", async () => {
    await db.transaction((tx) =>
      appendEntry(tx, {
        actorId: null,
        eventType: "EVENT_INGESTED",
        payload: { i: 1 },
        ts: "2026-10-27T00:00:01.000Z",
      }),
    );
    const res = await verify();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      count: 2,
      headHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it("verify route reports the failing seq after a tamper", async () => {
    await db.transaction((tx) =>
      appendEntry(tx, {
        actorId: null,
        eventType: "EVENT_INGESTED",
        payload: { i: 1 },
        ts: "2026-10-27T00:00:01.000Z",
      }),
    );
    await demoPool.query(
      `UPDATE ledger_entries SET payload = '{"i":2}' WHERE seq = 2`,
    );
    expect(await (await verify()).json()).toEqual({
      ok: false,
      failedAtSeq: 2,
      reason: "hash_mismatch",
    });
  });
});
