import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor } from "@/domain/types";
import { attachEvent } from "../cases/intake";
import { runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({
  description: z.string().trim().min(1).max(2000),
  relatedReference: z.string().trim().min(1).max(200).optional(),
});

/** Returns the receipt only: the declarant never learns the case id or ref (F11, US-04). */
export const declareIncidentCommand: CommandDef<
  z.infer<typeof schema>,
  { receiptId: string }
> = {
  action: "declareIncident",
  schema,
  handler: async (ctx, { description, relatedReference }) => {
    const receiptId = randomUUID();
    const { caseId, ref } = await attachEvent(ctx, {
      id: receiptId,
      kind: "manual_declaration",
      occurredAt: ctx.now,
      correlationKey: relatedReference ?? `decl:${receiptId}`,
      payload: {
        description,
        ...(relatedReference ? { relatedReference } : {}),
      },
      source: "manual",
      declaredBy: ctx.actor.id,
    });
    await ctx.log("INCIDENT_DECLARED", { receiptId, caseId, ref });
    return { receiptId };
  },
};

export const declareIncident = (actor: Actor | null, raw: unknown) =>
  runCommand(declareIncidentCommand, actor, raw);
