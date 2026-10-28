import "server-only";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { evaluate } from "@/domain/rules";
import type { Actor } from "@/domain/types";
import {
  getCase,
  insertSignal,
  nextId,
  regulatorInquiryOpen,
  sendNotice,
} from "../cases/engine";
import { authorize } from "../authz";
import { db, type Tx } from "../db/client";
import { cases, challengeFlags, receipts, signals } from "../db/schema";
import { Forbidden, NotFound } from "../errors";
import { logRefusal, runCommand, type CommandDef } from "../run-command";

// Employees can stay anonymous: the ledger then names "Anonymous employee", nothing more.
const who = (anonymous: boolean) =>
  anonymous ? "Anonymous employee" : "Employee";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** RC-XXXX: lets an anonymous employee follow up without revealing who they are. */
async function newReceipt(
  tx: Tx,
  r: Omit<typeof receipts.$inferInsert, "code">,
): Promise<string> {
  for (;;) {
    const code =
      "RC-" + Array.from({ length: 4 }, () => ALPHABET[randomInt(36)]).join("");
    const [taken] = await tx
      .select()
      .from(receipts)
      .where(eq(receipts.code, code));
    if (taken) continue;
    await tx.insert(receipts).values({ code, ...r });
    return code;
  }
}

const reportSchema = z.strictObject({
  text: z.string().trim().min(1).max(2000),
  anonymous: z.boolean(),
});

/** A staff report waits, unlinked, for Security to triage (mockup: A.report). */
export const reportIncidentCommand: CommandDef<
  z.infer<typeof reportSchema>,
  { code: string }
> = {
  action: "reportIncident",
  blocked: "Blocked: Report incident",
  schema: reportSchema,
  handler: async ({ tx, now, log }, { text, anonymous }) => {
    const id = await insertSignal(tx, {
      source: "Staff report",
      origin: "manual",
      detectedH: now,
      title: (anonymous ? "Anonymous: " : "") + text.slice(0, 60),
      entityKeys: [],
      anonymous,
    });
    await log("Incident reported", null, id, { actor: who(anonymous) });
    return { code: await newReceipt(tx, { kind: "report", signalId: id }) };
  },
};

const challengeSchema = z.strictObject({
  caseId: z.string().trim().toUpperCase(),
  text: z.string().trim().max(2000),
  anonymous: z.boolean(),
});

/** A challenge flag on a case; unresolved for 24 hours, the board is told (mockup: A.challenge). */
export const raiseChallengeCommand: CommandDef<
  z.infer<typeof challengeSchema>,
  { code: string; caseId: string }
> = {
  action: "raiseChallenge",
  blocked: "Blocked: Raise challenge",
  schema: challengeSchema,
  handler: async (ctx, { caseId, text, anonymous }) => {
    const { tx, now, log } = ctx;
    const c = await getCase(tx, caseId).catch(() => {
      throw new NotFound("No case “" + caseId + "”. Check the reference.");
    });
    const flagId = await nextId(tx, challengeFlags, "F", 0);
    await tx
      .insert(challengeFlags)
      .values({ id: flagId, caseId: c.id, text, anonymous, createdH: now });
    const facts = { ...c.facts, flags: c.facts.flags + 1 };
    const e = evaluate(facts, await regulatorInquiryOpen(tx));
    const becameHigh = c.severity === "LOW" && e.severity === "HIGH";
    await tx
      .update(cases)
      .set({
        facts,
        severity: e.severity,
        ...(becameHigh ? { status: "Open" } : {}),
      })
      .where(eq(cases.id, c.id));
    await log("Challenge raised", c.id, flagId + ": " + text.slice(0, 80), {
      actor: who(anonymous),
    });
    if (becameHigh) await sendNotice(ctx, c.id, 1, "t1");
    const code = await newReceipt(tx, {
      kind: "challenge",
      caseId: c.id,
      flagId,
    });
    return { code, caseId: c.id };
  },
};

export const reportIncident = (actor: Actor | null, raw: unknown) =>
  runCommand(reportIncidentCommand, actor, raw);

export const raiseChallenge = (actor: Actor | null, raw: unknown) =>
  runCommand(raiseChallengeCommand, actor, raw);

/** Read-only: what happened to a submission, by receipt code (mockup: A.status). */
export async function checkReceipt(
  actor: Actor | null,
  raw: unknown,
): Promise<{ message: string }> {
  const auth = authorize(actor, "checkReceipt");
  if (!auth.ok) {
    await logRefusal(actor, "Blocked: Check receipt", null, auth.reason);
    throw new Forbidden(auth.reason);
  }
  const code = z
    .string()
    .trim()
    .toUpperCase()
    .catch("")
    .parse((raw as { code?: unknown } | null)?.code);
  const [r] = await db.select().from(receipts).where(eq(receipts.code, code));
  if (!r) return { message: "No submission matches that code." };
  if (r.kind === "report") {
    const [s] = await db
      .select()
      .from(signals)
      .where(eq(signals.id, r.signalId!));
    return {
      message: s?.caseId
        ? "Linked to case " + s.caseId + "."
        : "Received by Security. Waiting for triage.",
    };
  }
  const c = await getCase(db, r.caseId!);
  return { message: "Case " + c.id + ": " + c.status + "." };
}
