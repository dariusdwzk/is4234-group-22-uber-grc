import "server-only";
import { count, desc, eq, inArray, and } from "drizzle-orm";
import type { EventKind, JsonValue } from "@/domain/types";
import { cases, intakeEvents, ledgerHead } from "../db/schema";
import type { CommandCtx } from "../run-command";
import { classifyCase } from "./classify";

/**
 * Shared by declareIncident and ingestEvent: correlate by key, create or reopen the case,
 * store the event, then re-classify. Returns the case and the stored event id.
 */
export async function attachEvent(
  ctx: CommandCtx,
  e: {
    id?: string;
    kind: EventKind;
    occurredAt: Date;
    correlationKey: string;
    payload: JsonValue;
    source: "manual" | "simulator";
    declaredBy?: string;
  },
): Promise<{ caseId: string; ref: string; eventId: string }> {
  const { tx, log } = ctx;
  // Serialise case creation: the ref is count + 1, so two creators must not interleave.
  await tx.select().from(ledgerHead).where(eq(ledgerHead.id, 1)).for("update");

  const [existing] = await tx
    .select()
    .from(cases)
    .where(
      and(
        eq(cases.correlationKey, e.correlationKey),
        inArray(cases.status, ["open", "auto_closed"]),
      ),
    )
    .orderBy(desc(cases.detectedAt))
    .limit(1);

  let caseId: string;
  let ref: string;
  if (existing) {
    caseId = existing.id;
    ref = existing.ref;
    if (existing.status === "auto_closed") {
      await tx
        .update(cases)
        .set({ status: "open" })
        .where(eq(cases.id, caseId));
      await log("CASE_REOPENED", { caseId, ref, kind: e.kind });
    }
  } else {
    const [{ n }] = (await tx.select({ n: count() }).from(cases)) as [
      { n: number },
    ];
    ref = `CASE-${String(n + 1).padStart(4, "0")}`;
    const [row] = await tx
      .insert(cases)
      .values({
        ref,
        correlationKey: e.correlationKey,
        source: e.source,
        detectedAt: e.occurredAt,
        declaredBy: e.declaredBy ?? null,
      })
      .returning({ id: cases.id });
    caseId = row!.id;
    await log("CASE_CREATED", { caseId, ref, source: e.source });
  }

  const [ev] = await tx
    .insert(intakeEvents)
    .values({
      ...(e.id ? { id: e.id } : {}),
      caseId,
      kind: e.kind,
      occurredAt: e.occurredAt,
      payload: e.payload,
    })
    .returning({ id: intakeEvents.id });
  await classifyCase(ctx, caseId);
  return { caseId, ref, eventId: ev!.id };
}
