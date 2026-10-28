import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Actor } from "@/domain/types";
import { getCase } from "../cases/engine";
import { cases, decisions } from "../db/schema";
import { Conflict } from "../errors";
import {
  caseIdOf,
  runCommand,
  type CommandCtx,
  type CommandDef,
} from "../run-command";

/** The mockup's doDisclose(): regulators and affected people are to be notified. */
export async function markDisclosed(
  ctx: CommandCtx,
  caseId: string,
): Promise<void> {
  await ctx.tx
    .update(cases)
    .set({ status: "Disclosed", disclosedH: ctx.now })
    .where(eq(cases.id, caseId));
  await ctx.log(
    "Disclosure approved",
    caseId,
    "Regulators and affected people to be notified.",
  );
}

const schema = z.strictObject({ caseId: z.string() });

/** One approver may always choose to disclose, unless a vote is still pending (mockup: A.discl). */
export const discloseCommand: CommandDef<z.infer<typeof schema>, void> = {
  action: "disclose",
  blocked: "Blocked: Approve disclosure",
  schema,
  handler: async (ctx, { caseId }) => {
    const c = await getCase(ctx.tx, caseId);
    if (c.severity !== "HIGH")
      throw new Conflict("Low-risk cases need no action.");
    if (c.status === "Disclosed") throw new Conflict("Already disclosed.");
    const [d] = await ctx.tx
      .select()
      .from(decisions)
      .where(eq(decisions.caseId, caseId));
    if (d?.status === "Pending")
      throw new Conflict("A decision is still pending.");
    await markDisclosed(ctx, caseId);
  },
};

export const disclose = (actor: Actor | null, raw: unknown) =>
  runCommand(discloseCommand, actor, raw, caseIdOf(raw));
