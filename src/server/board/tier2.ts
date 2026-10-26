import "server-only";
import { boardItems } from "../db/schema";
import type { CommandCtx } from "../run-command";

/**
 * Exactly-once Tier 2 escalation (US-19): the unique (case_id, reason_key) constraint decides,
 * so a double submit or a repeated sweep inserts nothing and logs nothing.
 */
export async function createTier2(
  ctx: CommandCtx,
  caseId: string,
  reasonKey: string,
  body: string,
): Promise<boolean> {
  const rows = await ctx.tx
    .insert(boardItems)
    .values({ caseId, tier: 2, reasonKey, body })
    .onConflictDoNothing({ target: [boardItems.caseId, boardItems.reasonKey] })
    .returning({ id: boardItems.id });
  if (rows.length === 0) return false;
  await ctx.log("TIER2_CREATED", { caseId, reasonKey });
  return true;
}
