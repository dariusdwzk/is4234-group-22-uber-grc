import { beforeEach, describe, expect, it } from "vitest";
import { GENESIS_PREV_HASH } from "@/domain/hash";
import { appPool, demoPool, ownerPool, resetTestDb } from "./setup/db";

const H1 = "1".repeat(64);

async function insertEntry(pool = appPool, seq = 1): Promise<void> {
  await pool.query(
    `INSERT INTO ledger_entries (seq, ts_iso, actor_id, event_type, payload, prev_hash, hash)
     VALUES ($1, '2026-10-27T00:00:00.000Z', NULL, 'GENESIS', '{"rulePackVersion":"v1"}', $2, $3)`,
    [seq, GENESIS_PREV_HASH, H1],
  );
}

describe("DB roles, grants and the append-only trigger", () => {
  beforeEach(async () => {
    await resetTestDb();
    await insertEntry();
  });

  it("app_rw can INSERT and SELECT ledger_entries", async () => {
    await insertEntry(appPool, 2);
    const { rows } = await appPool.query(
      "SELECT seq FROM ledger_entries ORDER BY seq",
    );
    expect(rows.map((r) => Number(r.seq))).toEqual([1, 2]);
  });

  it("app_rw cannot UPDATE ledger_entries", async () => {
    await expect(
      appPool.query("UPDATE ledger_entries SET payload = '{}' WHERE seq = 1"),
    ).rejects.toThrow(/permission denied/);
  });

  it("app_rw cannot DELETE ledger_entries", async () => {
    await expect(
      appPool.query("DELETE FROM ledger_entries WHERE seq = 1"),
    ).rejects.toThrow(/permission denied/);
  });

  it("app_rw cannot TRUNCATE ledger_entries", async () => {
    await expect(appPool.query("TRUNCATE ledger_entries")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("owner UPDATE ledger_entries blocked by trigger", async () => {
    await expect(
      ownerPool.query("UPDATE ledger_entries SET payload = '{}' WHERE seq = 1"),
    ).rejects.toThrow(/append-only/);
  });

  it("owner DELETE ledger_entries blocked by trigger", async () => {
    await expect(
      ownerPool.query("DELETE FROM ledger_entries WHERE seq = 1"),
    ).rejects.toThrow(/append-only/);
  });

  it("demo_admin can UPDATE ledger_entries", async () => {
    await demoPool.query(
      `UPDATE ledger_entries SET payload = '{"tampered":true}' WHERE seq = 1`,
    );
    const { rows } = await appPool.query(
      "SELECT payload FROM ledger_entries WHERE seq = 1",
    );
    expect(rows[0].payload).toEqual({ tampered: true });
  });

  it("demo_admin can TRUNCATE ledger_entries (reset path)", async () => {
    await demoPool.query("TRUNCATE ledger_entries");
    const { rows } = await appPool.query(
      "SELECT count(*)::int AS n FROM ledger_entries",
    );
    expect(rows[0].n).toBe(0);
  });

  it("app_rw can UPDATE mutable state but not append-only state tables", async () => {
    await appPool.query(
      "UPDATE ledger_head SET seq = 1, hash = $1 WHERE id = 1",
      [H1],
    );
    await appPool.query("UPDATE demo_settings SET offset_ms = 5 WHERE id = 1");
    await expect(
      appPool.query("UPDATE head_exports SET seq = 1"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      appPool.query("UPDATE intake_events SET kind = 'x'"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      appPool.query("UPDATE rule_evaluations SET tier = 'LOW'"),
    ).rejects.toThrow(/permission denied/);
  });

  it("app_rw can DELETE sessions but nothing else", async () => {
    await appPool.query("DELETE FROM sessions");
    await expect(appPool.query("DELETE FROM cases")).rejects.toThrow(
      /permission denied/,
    );
    await expect(appPool.query("DELETE FROM board_items")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("app_rw cannot TRUNCATE state tables or create objects", async () => {
    await expect(appPool.query("TRUNCATE cases CASCADE")).rejects.toThrow(
      /permission denied/,
    );
    await expect(appPool.query("CREATE TABLE sneaky (x int)")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("the ledger_head and demo_settings tables hold at most one row", async () => {
    await expect(
      appPool.query(
        "INSERT INTO ledger_head (id, seq, hash) VALUES (2, 0, $1)",
        [GENESIS_PREV_HASH],
      ),
    ).rejects.toThrow(/ledger_head_single_row/);
  });

  it("board_items rejects a second row for the same case and reason (US-19 exactly once)", async () => {
    const { rows } = await ownerPool.query(
      `INSERT INTO cases (ref, correlation_key, source, detected_at)
       VALUES ('CASE-0001', 'k', 'manual', now()) RETURNING id`,
    );
    const caseId = rows[0].id as string;
    const insert = () =>
      appPool.query(
        `INSERT INTO board_items (case_id, tier, reason_key, body) VALUES ($1, 2, 'disagreement', 'b')`,
        [caseId],
      );
    await insert();
    await expect(insert()).rejects.toThrow(/board_items_case_reason_uq/);
  });
});
