import "server-only";
import { eq } from "drizzle-orm";
import { INDEPENDENT_REASON, canAccessCase } from "@/domain/case-access";
import type { Actor } from "@/domain/types";
import { authorize } from "../authz";
import { getCase } from "../cases/engine";
import { db } from "../db/client";
import { evidence } from "../db/schema";
import { Forbidden, NotFound } from "../errors";
import { logRefusal } from "../run-command";

/** The stored file, if the role may see its case. A refusal is logged like any other. */
export async function downloadEvidence(
  actor: Actor | null,
  id: number,
): Promise<{ name: string; type: string; data: Buffer }> {
  if (!Number.isInteger(id)) throw new NotFound("No such evidence.");
  const [e] = await db.select().from(evidence).where(eq(evidence.id, id));
  if (!e?.fileData || !e.fileName || !e.fileType)
    throw new NotFound("No file for this evidence.");
  const c = await getCase(db, e.caseId);
  const auth = authorize(actor, "viewCases");
  const reason = !auth.ok
    ? auth.reason
    : !canAccessCase(actor?.role ?? null, c.route)
      ? INDEPENDENT_REASON
      : null;
  if (reason) {
    await logRefusal(actor, "Blocked: Download evidence", c.id, reason);
    throw new Forbidden(reason);
  }
  return { name: e.fileName, type: e.fileType, data: e.fileData };
}
