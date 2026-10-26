import "server-only";
import { z } from "zod";
import { EVENT_PAYLOAD_SCHEMAS } from "@/domain/event-payloads";
import type { Actor, EventKind, JsonValue } from "@/domain/types";
import { attachEvent } from "../cases/intake";
import { runCommand, type CommandDef } from "../run-command";

const KINDS = Object.keys(EVENT_PAYLOAD_SCHEMAS) as [EventKind, ...EventKind[]];

const schema = z
  .strictObject({
    kind: z.enum(KINDS),
    occurredAt: z.iso.datetime(),
    correlationKey: z.string().trim().min(1).max(200),
    payload: z.unknown(),
  })
  .superRefine((v, ctx) => {
    const r = EVENT_PAYLOAD_SCHEMAS[v.kind].safeParse(v.payload);
    if (!r.success)
      for (const issue of r.error.issues)
        ctx.addIssue({
          code: "custom",
          path: ["payload", ...issue.path],
          message: issue.message,
        });
  });

export type IngestEventInput = z.infer<typeof schema>;

export const ingestEventCommand: CommandDef<
  IngestEventInput,
  { caseId: string }
> = {
  action: "ingestEvent",
  schema,
  handler: async (ctx, input) => {
    const payload = EVENT_PAYLOAD_SCHEMAS[input.kind].parse(
      input.payload,
    ) as JsonValue;
    const { caseId, ref, eventId } = await attachEvent(ctx, {
      kind: input.kind,
      occurredAt: new Date(input.occurredAt),
      correlationKey: input.correlationKey,
      payload,
      source: "simulator",
    });
    await ctx.log("EVENT_INGESTED", {
      caseId,
      ref,
      eventId,
      kind: input.kind,
      source: "simulator",
    });
    return { caseId };
  },
};

export const ingestEvent = (actor: Actor | null, raw: unknown) =>
  runCommand(ingestEventCommand, actor, raw);
