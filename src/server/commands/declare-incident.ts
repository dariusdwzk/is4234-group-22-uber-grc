import "server-only";
import { z } from "zod";
import type { Actor } from "@/domain/types";
import { ingest, insertSignal } from "../cases/engine";
import { runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({ text: z.string().trim().min(1).max(2000) });

/** Security declares an incident no system flagged; it opens its own case (mockup: A.declare). */
export const declareIncidentCommand: CommandDef<
  z.infer<typeof schema>,
  { caseId: string }
> = {
  action: "declareIncident",
  blocked: "Blocked: Declare incident",
  schema,
  handler: async (ctx, { text }) => {
    const id = await insertSignal(ctx.tx, {
      source: "Declared",
      origin: "manual",
      detectedH: ctx.now,
      title: text.slice(0, 70),
      entityKeys: [], // no keys: a declaration never merges into another case
    });
    await ctx.log("Incident declared", null, id);
    return { caseId: await ingest(ctx, id) };
  },
};

export const declareIncident = (actor: Actor | null, raw: unknown) =>
  runCommand(declareIncidentCommand, actor, raw);
