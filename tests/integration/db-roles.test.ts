import { beforeEach, describe, expect, it } from "vitest";
import { GENESIS_PREV_HASH } from "@/domain/hash";
import { appPool, demoPool, ownerPool, resetTestDb } from "./setup/db";

const H1 = "1".repeat(64);

async function insertEntry(pool = appPool, seq = 1): Promise<void> {
  await pool.query(
    `INSERT INTO ledger_entries (seq, ts_iso, actor_id, event_type, payload, prev_hash, hash)
     VALUES ($1, '2026-11-16T09:00:00.000Z', NULL, 'GENESIS', '{}', $2, $3)`,
    [seq, GENESIS_PREV_HASH, H1],
  );
}

async function insertCase(id = "C-104"): Promise<void> {
  await ownerPool.query(
    `INSERT INTO cases (id, title, severity, status, detected_h, facts)
     VALUES ($1, 't', 'HIGH', 'Open', 0, '{}')`,
    [id],
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

  it("app_rw and demo_admin cannot UPDATE, DELETE or TRUNCATE-and-edit ledger_entries", async () => {
    for (const pool of [appPool, demoPool]) {
      await expect(
        pool.query("UPDATE ledger_entries SET payload = '{}' WHERE seq = 1"),
      ).rejects.toThrow(/permission denied/);
      await expect(
        pool.query("DELETE FROM ledger_entries WHERE seq = 1"),
      ).rejects.toThrow(/permission denied/);
    }
    await expect(appPool.query("TRUNCATE ledger_entries")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("even the owner is stopped by the append-only trigger", async () => {
    await expect(
      ownerPool.query("UPDATE ledger_entries SET payload = '{}' WHERE seq = 1"),
    ).rejects.toThrow(/append-only/);
    await expect(
      ownerPool.query("DELETE FROM ledger_entries WHERE seq = 1"),
    ).rejects.toThrow(/append-only/);
  });

  it("demo_admin can TRUNCATE everything (reset path)", async () => {
    await demoPool.query(
      "TRUNCATE ledger_entries, ledger_head, settings CASCADE",
    );
    const { rows } = await appPool.query(
      "SELECT count(*)::int AS n FROM ledger_entries",
    );
    expect(rows[0].n).toBe(0);
  });

  it("app_rw can UPDATE moving state but not evidence tables", async () => {
    await insertCase();
    await appPool.query(
      "UPDATE ledger_head SET seq = 1, hash = $1 WHERE id = 1",
      [H1],
    );
    await appPool.query("UPDATE settings SET clock_h = 24 WHERE id = 1");
    await appPool.query(
      "UPDATE cases SET status = 'Disclosed' WHERE id = 'C-104'",
    );
    for (const stmt of [
      "UPDATE approvals SET vote = 'approve'",
      "UPDATE recommendations SET action = 'disclose'",
      "UPDATE receipts SET kind = 'report'",
      "UPDATE external_anchors SET seq = 1",
    ])
      await expect(appPool.query(stmt)).rejects.toThrow(/permission denied/);
  });

  it("app_rw cannot DELETE, TRUNCATE or create objects", async () => {
    await expect(appPool.query("DELETE FROM board_notices")).rejects.toThrow(
      /permission denied/,
    );
    await expect(appPool.query("TRUNCATE cases CASCADE")).rejects.toThrow(
      /permission denied/,
    );
    await expect(appPool.query("CREATE TABLE sneaky (x int)")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("ledger_head and settings hold at most one row", async () => {
    await expect(
      appPool.query(
        "INSERT INTO ledger_head (id, seq, hash) VALUES (2, 0, $1)",
        [GENESIS_PREV_HASH],
      ),
    ).rejects.toThrow(/ledger_head_single_row/);
    await expect(
      appPool.query("INSERT INTO settings (id, clock_h) VALUES (2, 0)"),
    ).rejects.toThrow(/settings_single_row/);
  });

  it("one vote per approver per decision, and one notice per case and kind", async () => {
    await insertCase();
    await ownerPool.query(
      `INSERT INTO decisions (case_id, type, need, disclose, created_h) VALUES ('C-104', 'x', 2, false, 0)`,
    );
    const vote = () =>
      appPool.query(
        `INSERT INTO approvals (case_id, role, vote, reason, created_h) VALUES ('C-104', 'gc', 'approve', 'r', 0)`,
      );
    await vote();
    await expect(vote()).rejects.toThrow(/approvals_case_role_uq/);

    const notice = (id: string) =>
      appPool.query(
        `INSERT INTO board_notices (id, case_id, tier, kind, body, created_h) VALUES ($1, 'C-104', 2, 'deadline', 'b', 0)`,
        [id],
      );
    await notice("N-1");
    await expect(notice("N-2")).rejects.toThrow(/board_notices_case_kind_uq/);
  });
});
