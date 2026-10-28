import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Actor } from "@/domain/types";
import { getCase } from "../cases/engine";
import { cases } from "../db/schema";
import { Conflict } from "../errors";
import { caseIdOf, runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({
  caseId: z.string(),
  text: z.string().trim().max(2000),
});

/** Security records what the investigation confirmed (mockup: A.finding). */
export const recordFindingCommand: CommandDef<z.infer<typeof schema>, void> = {
  action: "recordFinding",
  blocked: "Blocked: Add finding",
  schema,
  handler: async ({ tx, log }, { caseId, text }) => {
    const c = await getCase(tx, caseId);
    if (c.severity !== "HIGH")
      throw new Conflict("Low-risk cases need no action.");
    if (c.finding) throw new Conflict("A finding is already recorded.");
    const finding = text || "Finding recorded";
    await tx.update(cases).set({ finding }).where(eq(cases.id, caseId));
    await log("Finding recorded", caseId, finding);
  },
};

export const recordFinding = (actor: Actor | null, raw: unknown) =>
  runCommand(recordFindingCommand, actor, raw, caseIdOf(raw));
