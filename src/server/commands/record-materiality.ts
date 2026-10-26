import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Actor } from "@/domain/types";
import { cases } from "../db/schema";
import { Conflict, NotFound } from "../errors";
import { runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({ caseId: z.uuid() });

/** GC records the materiality determination once; it starts the SEC clock. */
export const recordMaterialityCommand: CommandDef<
  z.infer<typeof schema>,
  void
> = {
  action: "recordMateriality",
  schema,
  handler: async ({ tx, now, log }, { caseId }) => {
    const [c] = await tx
      .select({ status: cases.status })
      .from(cases)
      .where(eq(cases.id, caseId));
    if (!c) throw new NotFound();
    if (c.status !== "open") throw new Conflict("case is not open");
    const rows = await tx
      .update(cases)
      .set({ materialityDeterminedAt: now })
      .where(and(eq(cases.id, caseId), isNull(cases.materialityDeterminedAt)))
      .returning({ id: cases.id });
    if (rows.length === 0)
      throw new Conflict("materiality already determined for this case");
    await log("MATERIALITY_RECORDED", { caseId });
  },
};

export const recordMateriality = (actor: Actor | null, raw: unknown) =>
  runCommand(recordMaterialityCommand, actor, raw);
