import "server-only";
import type { z } from "zod";
import type { Actor, JsonValue } from "@/domain/types";
import { SYSTEM_ACTOR } from "@/domain/types";
import { authorize, type Action } from "./authz";
import { getNow } from "./clock";
import { db, type Tx } from "./db/client";
import { sweepEscalations } from "./escalation";
import { Forbidden, ValidationError } from "./errors";
import { appendEntry, type LedgerEventType } from "./ledger/append";

export type CommandCtx = {
  tx: Tx;
  actor: Actor;
  now: Date;
  nowIso: string;
  /** Appends to the ledger inside this command's transaction. actorId defaults to the actor. */
  log: (
    eventType: LedgerEventType,
    payload: JsonValue,
    opts?: { actorId?: string | null },
  ) => Promise<void>;
};

export type CommandDef<I, O> = {
  action: Action;
  schema: z.ZodType<I>;
  handler: (ctx: CommandCtx, input: I) => Promise<O>;
};

/** A refusal is itself an auditable event (F-series: failures must be visible). Own transaction. */
async function logRefusal(
  actor: Actor | null,
  action: Action,
  reason: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const ts = (await getNow(tx)).toISOString();
    await appendEntry(tx, {
      actorId: actor?.id ?? null,
      eventType: "REFUSED",
      payload: { action, reason, actorRole: actor?.role ?? null },
      ts,
    });
  });
}

/**
 * The single mutation pipeline (spec §3). Order is load-bearing:
 * parse (nothing logged) → authorize (refusal logged) → one transaction that locks the
 * ledger head, sweeps escalations, runs the handler and appends its entries.
 */
export async function runCommand<I, O>(
  def: CommandDef<I, O>,
  actor: Actor | null,
  raw: unknown,
): Promise<O> {
  const parsed = def.schema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues);

  const auth = authorize(actor, def.action);
  if (!auth.ok) {
    await logRefusal(actor, def.action, auth.reason);
    throw new Forbidden(auth.reason);
  }

  try {
    return await db.transaction(async (tx) => {
      const now = await getNow(tx);
      const nowIso = now.toISOString();
      const effectiveActor = actor ?? SYSTEM_ACTOR; // only reachable for public actions (login)
      const ctx: CommandCtx = {
        tx,
        actor: effectiveActor,
        now,
        nowIso,
        log: async (eventType, payload, opts) => {
          await appendEntry(tx, {
            actorId:
              opts && "actorId" in opts
                ? (opts.actorId ?? null)
                : effectiveActor.id,
            eventType,
            payload,
            ts: nowIso,
          });
        },
      };
      await sweepEscalations(ctx);
      return def.handler(ctx, parsed.data);
    });
  } catch (err) {
    // Business-rule refusal inside the handler: state has rolled back, the refusal must persist.
    if (err instanceof Forbidden)
      await logRefusal(actor, def.action, err.reason);
    throw err;
  }
}
