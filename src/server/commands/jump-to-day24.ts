import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { JUMP_H } from "@/domain/demo-time";
import { initialPaymentStatus } from "@/domain/payments";
import type { Actor } from "@/domain/types";
import { getCase, ingest, insertSignal, runEscalations } from "../cases/engine";
import { payments, settings, signals } from "../db/schema";
import { assertDemoMode } from "../demo";
import { Conflict } from "../errors";
import {
  logFor,
  runCommand,
  type CommandCtx,
  type CommandDef,
} from "../run-command";

const AMOUNT_CENTS = 10_000_000;

/** Day 24: the HackerOne report and the US$100,000 request arrive and merge (mockup: A.jump). */
export const jumpToDay24Command: CommandDef<
  Record<string, never>,
  { caseId: string }
> = {
  action: "jumpToDay24",
  blocked: "Blocked: Jump to Day 24",
  schema: z.strictObject({}),
  handler: async (ctx) => {
    const { tx } = ctx;
    const [arrived] = await tx
      .select({ id: signals.id })
      .from(signals)
      .where(
        and(
          eq(signals.source, "HackerOne"),
          sql`'jdough' = ANY(${signals.entityKeys})`,
        ),
      );
    if (arrived) throw new Conflict("The payment request has already arrived.");

    const now = Math.max(ctx.now, JUMP_H);
    await tx.update(settings).set({ clockH: now }).where(eq(settings.id, 1));
    // Everything after the jump happens at the new time.
    const at: CommandCtx = { ...ctx, now, log: logFor(tx, ctx.actor, now) };
    await runEscalations(at);

    const report = await insertSignal(tx, {
      source: "HackerOne",
      origin: "system",
      detectedH: now - 2,
      title: "Report from “jdough”: AWS keys used to download rider-backup",
      entityKeys: ["rider-backup", "jdough"],
      facts: { extortion: true },
    });
    await at.log("Signal received", null, report + ": report from jdough", {
      actor: "HackerOne",
      t: now - 2,
    });
    await ingest(at, report);

    const request = await insertSignal(tx, {
      source: "Finance",
      origin: "system",
      detectedH: now,
      title: "Payment request: US$100,000 to jdough (unverified)",
      entityKeys: ["jdough"],
      facts: { paymentCents: AMOUNT_CENTS, payeeVerified: false },
    });
    await at.log(
      "Signal received",
      null,
      request + ": payment request US$100,000",
      {
        actor: "Finance",
      },
    );
    const caseId = await ingest(at, request);

    const c = await getCase(tx, caseId);
    const status = initialPaymentStatus(c.severity);
    const count = (await tx.select({ id: payments.id }).from(payments)).length;
    await tx.insert(payments).values({
      id: "PAY-" + (count + 1),
      caseId,
      payee: "jdough (unverified)",
      amountCents: AMOUNT_CENTS,
      status,
      createdH: now,
    });
    if (status === "Held")
      await at.log(
        "Payment held",
        caseId,
        "US$100,000 to jdough. Linked to an open HIGH case: frozen while the case is open.",
        { actor: "System" },
      );
    return { caseId };
  },
};

export const jumpToDay24 = async (actor: Actor | null, raw: unknown) => {
  assertDemoMode();
  return runCommand(jumpToDay24Command, actor, raw);
};
