import "server-only";
import { sql } from "drizzle-orm";
import type { Actor } from "@/domain/types";
import { authorize } from "../authz";
import { getDemoDb } from "../db/demo-client";
import { Forbidden } from "../errors";
import { exportHead } from "../ledger/export-head";
import { appendEntry } from "../ledger/append";
import { logRefusal } from "../run-command";
import { seed } from "../seed/seed";

// head_exports is deliberately absent: the simulated auditor inbox survives a reset.
const STATE_TABLES = [
  "board_items",
  "challenge_flags",
  "decisions",
  "recommendations",
  "rule_evaluations",
  "intake_events",
  "cases",
  "sessions",
  "users",
  "rule_packs",
  "ledger_entries",
  "ledger_head",
  "demo_settings",
];

/**
 * Not routed through runCommand: it must run on the demo_admin connection (TRUNCATE rights),
 * which runCommand's app_rw transaction cannot do. It keeps the same order of checks.
 */
export async function resetDemo(
  actor: Actor,
  demoPassword: string,
): Promise<void> {
  const demoDb = getDemoDb(); // throws NotFound unless DEMO_MODE=true
  const auth = authorize(actor, "resetDemo");
  if (!auth.ok) {
    await logRefusal(actor, "resetDemo", auth.reason);
    throw new Forbidden(auth.reason);
  }

  await demoDb.transaction(async (tx) => {
    const now = new Date();
    const previousHead = await exportHead(tx, actor.id, now.toISOString());
    await tx.execute(sql.raw(`TRUNCATE ${STATE_TABLES.join(", ")} CASCADE`));
    const ids = await seed(tx, { demoPassword, now });
    await appendEntry(tx, {
      actorId: ids.demo ?? null, // the old actor id no longer exists after re-seeding
      eventType: "DEMO_RESET",
      payload: { previousHead },
      ts: now.toISOString(),
    });
  });
}
