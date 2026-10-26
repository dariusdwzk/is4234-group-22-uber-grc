import "server-only";
import { eq } from "drizzle-orm";
import type { Actor } from "@/domain/types";
import { authorize } from "../authz";
import { db } from "../db/client";
import { cases, challengeFlags } from "../db/schema";
import { Forbidden } from "../errors";
import { logRefusal } from "../run-command";

/** Open flags for the roles that may resolve them (ACC, IA). */
export async function getBoardFlags(
  actor: Actor | null,
): Promise<{ id: string; ref: string; text: string }[]> {
  const auth = authorize(actor, "resolveFlag");
  if (!auth.ok) {
    await logRefusal(actor, "resolveFlag", auth.reason);
    throw new Forbidden(auth.reason);
  }
  const rows = await db
    .select({
      id: challengeFlags.id,
      ref: cases.ref,
      text: challengeFlags.text,
    })
    .from(challengeFlags)
    .innerJoin(cases, eq(cases.id, challengeFlags.caseId))
    .where(eq(challengeFlags.status, "open"));
  return rows;
}
