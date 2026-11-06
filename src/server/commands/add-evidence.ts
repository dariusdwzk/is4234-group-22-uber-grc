import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { fileProblem, safeFileName } from "@/domain/evidence";
import type { Actor, RoleKey } from "@/domain/types";
import { getCaseFor } from "../cases/engine";
import { evidence } from "../db/schema";
import { ValidationError } from "../errors";
import { caseIdOf, runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({
  caseId: z.string(),
  note: z.string().trim().min(1).max(2000),
  /** Optional attachment, sent as base64. Checked again on the server. */
  file: z
    .strictObject({
      name: z.string().min(1).max(255),
      type: z.string(),
      base64: z.string().max(3_000_000),
    })
    .optional(),
});

/**
 * The GC or CPO adds evidence while investigating an INDEPENDENT case. Append-only; the
 * ledger records the note and, for a file, its SHA-256 so a swapped file would show.
 */
export const addEvidenceCommand: CommandDef<
  z.infer<typeof schema>,
  { id: number }
> = {
  action: "addEvidence",
  blocked: "Blocked: Add evidence",
  schema,
  handler: async (ctx, { caseId, note, file }) => {
    await getCaseFor(ctx, caseId, { investigate: true });
    let attached: {
      fileName: string;
      fileType: string;
      fileSize: number;
      fileSha256: string;
      fileData: Buffer;
    } | null = null;
    if (file) {
      const data = Buffer.from(file.base64, "base64");
      const problem = fileProblem({
        name: file.name,
        type: file.type,
        size: data.length,
      });
      if (problem) throw new ValidationError([{ message: problem }], problem);
      const hash = createHash("sha256").update(data).digest("hex");
      attached = {
        fileName: safeFileName(file.name),
        fileType: file.type,
        fileSize: data.length,
        fileSha256: hash,
        fileData: data,
      };
    }
    const [row] = await ctx.tx
      .insert(evidence)
      .values({
        caseId,
        authorRole: ctx.actor.role as RoleKey,
        note,
        createdH: ctx.now,
        ...(attached ?? {}),
      })
      .returning({ id: evidence.id });
    await ctx.log(
      "Evidence added",
      caseId,
      note +
        (attached
          ? " File: " +
            attached.fileName +
            ", SHA-256 " +
            attached.fileSha256 +
            "."
          : ""),
    );
    return { id: row!.id };
  },
};

export const addEvidence = (actor: Actor | null, raw: unknown) =>
  runCommand(addEvidenceCommand, actor, raw, caseIdOf(raw));
