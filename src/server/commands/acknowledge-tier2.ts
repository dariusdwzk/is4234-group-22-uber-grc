import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Actor } from "@/domain/types";
import { boardItems } from "../db/schema";
import { Conflict, NotFound } from "../errors";
import { runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({
  itemId: z.uuid(),
  actionNote: z.string().trim().min(5).max(2000),
});

/** ACC handles a Tier 2 item with a note. Tier 1 is read-only and can never be acknowledged. */
export const acknowledgeTier2Command: CommandDef<
  z.infer<typeof schema>,
  void
> = {
  action: "acknowledgeTier2",
  schema,
  handler: async ({ tx, actor, now, log }, { itemId, actionNote }) => {
    const rows = await tx
      .update(boardItems)
      .set({
        status: "acknowledged",
        ackNote: actionNote,
        ackBy: actor.id,
        ackAt: now,
      })
      .where(
        and(
          eq(boardItems.id, itemId),
          eq(boardItems.tier, 2),
          eq(boardItems.status, "open"),
        ),
      )
      .returning({ caseId: boardItems.caseId });
    if (rows.length === 0) {
      const [item] = await tx
        .select({ id: boardItems.id })
        .from(boardItems)
        .where(eq(boardItems.id, itemId));
      if (!item) throw new NotFound();
      throw new Conflict("item is not an open Tier 2 item");
    }
    await log("TIER2_ACKNOWLEDGED", {
      itemId,
      caseId: rows[0]!.caseId,
      actionNote,
    });
  },
};

export const acknowledgeTier2 = (actor: Actor | null, raw: unknown) =>
  runCommand(acknowledgeTier2Command, actor, raw);
