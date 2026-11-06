import "server-only";
import type { z } from "zod";
import { hoursToIso } from "@/domain/demo-time";
import type { Actor } from "@/domain/types";
import { SYSTEM_ACTOR } from "@/domain/types";
import { authorize, type Action } from "./authz";
import { runEscalations } from "./cases/engine";
import { getNow } from "./clock";
import { db, type Tx } from "./db/client";
import { Forbidden, ValidationError } from "./errors";
import {
  appendEntry,
  lockHead,
  type BlockedEventType,
  type LedgerEventType,
} from "./ledger/append";

export type LogOpts = {
  /** Who the entry names; defaults to the acting role. Signals use "Cloud monitoring" etc. */
  actor?: string;
  /** Hours since Day 0; defaults to now. */
  t?: number;
};

export type CommandCtx = {
  tx: Tx;
  actor: Actor;
  /** Hours since Day 0. */
  now: number;
  /** Appends to the ledger inside this command's transaction (mockup: log()). */
  log: (
    action: LedgerEventType,
    caseId: string | null,
    detail: string,
    opts?: LogOpts,
  ) => Promise<void>;
};

export type CommandDef<I, O> = {
  action: Action;
  /** The ledger action written when this command is refused, e.g. "Blocked: Close case". */
  blocked: BlockedEventType;
  schema: z.ZodType<I>;
  handler: (ctx: CommandCtx, input: I) => Promise<O>;
};

export function logFor(tx: Tx, actor: Actor, now: number): CommandCtx["log"] {
  return async (action, caseId, detail, opts) => {
    await appendEntry(tx, {
      actorId: opts?.actor ?? actor.name,
      eventType: action,
      payload: { caseId: caseId ?? "", detail },
      ts: hoursToIso(opts?.t ?? now),
    });
  };
}

/** A refusal is itself evidence the board can see. Own transaction, so it survives a rollback. */
export async function logRefusal(
  actor: Actor | null,
  blocked: BlockedEventType,
  caseId: string | null,
  reason: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockHead(tx);
    const now = await getNow(tx);
    await logFor(tx, actor ?? { role: null, name: "Unknown" }, now)(
      blocked,
      caseId,
      reason,
    );
  });
}

/**
 * The single mutation pipeline. Order is load-bearing:
 * parse (nothing logged) → authorize (refusal logged) → one transaction that locks the
 * ledger head, runs the handler and appends its entries.
 */
export async function runCommand<I, O>(
  def: CommandDef<I, O>,
  actor: Actor | null,
  raw: unknown,
  caseId: string | null = null,
): Promise<O> {
  const parsed = def.schema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues);

  const auth = authorize(actor, def.action);
  if (!auth.ok) {
    await logRefusal(actor, def.blocked, caseId, auth.reason);
    throw new Forbidden(auth.reason);
  }

  try {
    return await db.transaction(async (tx) => {
      await lockHead(tx); // first statement: one global lock order (head, then rows)
      const now = await getNow(tx);
      const acting = actor ?? SYSTEM_ACTOR; // only demo actions run without a role
      const ctx: CommandCtx = {
        tx,
        actor: acting,
        now,
        log: logFor(tx, acting, now),
      };
      // Escalations are checked lazily on every request (no cron); they act as the System.
      await runEscalations({ ...ctx, log: logFor(tx, SYSTEM_ACTOR, now) });
      return def.handler(ctx, parsed.data);
    });
  } catch (err) {
    // Business-rule refusal inside the handler: state has rolled back, the refusal must persist.
    if (err instanceof Forbidden)
      await logRefusal(
        actor,
        err.opts.blocked ?? def.blocked,
        err.opts.caseId ?? caseId,
        err.opts.detail ?? err.reason,
      );
    throw err;
  }
}

/** The case a request names, so a refusal is logged against it. */
export function caseIdOf(raw: unknown): string | null {
  const id = (raw as { caseId?: unknown } | null)?.caseId;
  return typeof id === "string" ? id : null;
}
