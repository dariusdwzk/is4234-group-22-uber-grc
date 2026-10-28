import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Actor } from "@/domain/types";
import { addToCase, getCaseFor, insertSignal } from "../cases/engine";
import { signals } from "../db/schema";
import { Conflict } from "../errors";
import { caseIdOf, runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({
  caseId: z.string(),
  text: z.string().trim().max(2000),
});

/** The CSO attaches the hacker's email, which no monitored system saw (mockup: A.attach). */
export const attachContactCommand: CommandDef<z.infer<typeof schema>, void> = {
  action: "attachContact",
  blocked: "Blocked: Attach to case",
  schema,
  handler: async (ctx, { caseId, text }) => {
    const { tx, now, actor, log } = ctx;
    const c = await getCaseFor(ctx, caseId);
    if (c.severity !== "HIGH")
      throw new Conflict("Low-risk cases need no action.");
    const [already] = await tx
      .select({ id: signals.id })
      .from(signals)
      .where(
        and(eq(signals.caseId, caseId), eq(signals.source, "Email to CSO")),
      );
    if (already) throw new Conflict("The email is already attached.");
    const id = await insertSignal(tx, {
      source: "Email to CSO",
      origin: "manual",
      detectedH: now,
      title: text.slice(0, 80) || "Email from anonymous sender",
      entityKeys: ["jdough"],
      facts: { extortion: true },
    });
    await log(
      "Out-of-band contact attached",
      caseId,
      id + ": email to the CSO",
    );
    await addToCase(ctx, caseId, id, "attached by " + actor.name + ".");
  },
};

export const attachContact = (actor: Actor | null, raw: unknown) =>
  runCommand(attachContactCommand, actor, raw, caseIdOf(raw));
