import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Actor } from "@/domain/types";
import { createTier2 } from "../board/tier2";
import { classifyCase } from "../cases/classify";
import { cases, challengeFlags } from "../db/schema";
import { runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({
  caseRef: z.string().trim().min(1).max(40),
  text: z.string().trim().min(5).max(2000),
});

/**
 * Any signed-in user can challenge a case (F6). The caller learns only whether it was recorded,
 * never whether the ref exists. challenge_flags needs a case, so a flag on an unknown ref is
 * kept as a FLAG_RAISED ledger entry (matched:false) that the board lists.
 */
export const raiseFlagCommand: CommandDef<
  z.infer<typeof schema>,
  { matched: boolean }
> = {
  action: "raiseFlag",
  schema,
  handler: async (ctx, { caseRef, text }) => {
    const { tx, actor, log } = ctx;
    const [c] = await tx.select().from(cases).where(eq(cases.ref, caseRef));
    if (!c) {
      await log("FLAG_RAISED", { caseRef, text, matched: false });
      return { matched: false };
    }
    const [flag] = await tx
      .insert(challengeFlags)
      .values({ caseId: c.id, raisedBy: actor.id, text })
      .returning({ id: challengeFlags.id });
    await log("FLAG_RAISED", {
      caseRef,
      caseId: c.id,
      flagId: flag!.id,
      text,
      matched: true,
    });
    await createTier2(
      ctx,
      c.id,
      `flag:${flag!.id}`,
      `Case ${c.ref}: an employee raised a challenge flag — "${text}"`,
    );
    const { becameHigh } = await classifyCase(ctx, c.id);
    if (becameHigh && c.status === "auto_closed") {
      await tx.update(cases).set({ status: "open" }).where(eq(cases.id, c.id));
      await log("CASE_REOPENED", { caseId: c.id, ref: c.ref, kind: "flag" });
    }
    return { matched: true };
  },
};

export const raiseFlag = (actor: Actor | null, raw: unknown) =>
  runCommand(raiseFlagCommand, actor, raw);
