import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Actor } from "@/domain/types";
import { boardNotices } from "../db/schema";
import { Conflict, NotFound } from "../errors";
import { runCommand, type CommandDef } from "../run-command";

const schema = z.strictObject({ noticeId: z.string() });

/** The board's only action: a read receipt. Decisions happen in board meetings (mockup: A.ack). */
export const acknowledgeNoticeCommand: CommandDef<
  z.infer<typeof schema>,
  void
> = {
  action: "acknowledgeNotice",
  blocked: "Blocked: Acknowledge notice",
  schema,
  handler: async ({ tx, now, log }, { noticeId }) => {
    const [n] = await tx
      .select()
      .from(boardNotices)
      .where(eq(boardNotices.id, noticeId));
    if (!n) throw new NotFound("No notice " + noticeId);
    if (n.ackH !== null) throw new Conflict("Already acknowledged.");
    await tx
      .update(boardNotices)
      .set({ ackH: now })
      .where(eq(boardNotices.id, noticeId));
    await log("Notice acknowledged", n.caseId, n.id);
  },
};

export const acknowledgeNotice = (actor: Actor | null, raw: unknown) =>
  runCommand(acknowledgeNoticeCommand, actor, raw);
