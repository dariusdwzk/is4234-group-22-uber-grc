import "server-only";
import { sql } from "drizzle-orm";
import { assertDemoMode } from "../demo";
import { getDemoDb } from "../db/demo-client";
import { seed } from "../seed/seed";

// Every table: the mockup's reset starts the story over, including the ledger and anchors.
const TABLES = [
  "receipts",
  "approvals",
  "decisions",
  "recommendations",
  "payments",
  "challenge_flags",
  "board_notices",
  "signals",
  "cases",
  "external_anchors",
  "ledger_entries",
  "ledger_head",
  "settings",
];

/**
 * Not routed through runCommand: it needs the demo_admin connection (TRUNCATE rights),
 * which runCommand's app_rw transaction cannot do. Open to any role, as in the mockup.
 */
export async function resetDemo(): Promise<void> {
  assertDemoMode();
  await getDemoDb().transaction(async (tx) => {
    // Queue ahead of every writer: row-locking the head first deadlocks with appends that
    // already wait on it while holding a table lock that TRUNCATE needs.
    await tx.execute(sql`LOCK TABLE ledger_head IN ACCESS EXCLUSIVE MODE`);
    // No RESTART IDENTITY: that needs sequence ownership, and no serial id is ever shown.
    await tx.execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} CASCADE`));
    await seed(tx);
  });
}
