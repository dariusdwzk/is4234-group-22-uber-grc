import "server-only";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Actor } from "@/domain/types";
import { authorize } from "../authz";
import { getDemoDb } from "../db/demo-client";
import { ledgerEntries } from "../db/schema";
import { assertDemoMode } from "../demo";
import { Forbidden, NotFound, ValidationError } from "../errors";
import { logRefusal } from "../run-command";

const schema = z.strictObject({ seq: z.number().int().min(2) });

/**
 * Demo only (spec §5): alters the payload of entry N on the demo_admin connection without
 * recomputing its hash, and is deliberately not chained, so verify must fail at N.
 * Not routed through runCommand (app_rw cannot UPDATE the ledger); same order of checks.
 */
export async function tamperEntry(
  actor: Actor | null,
  raw: unknown,
): Promise<{ seq: number }> {
  assertDemoMode();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues);
  const auth = authorize(actor, "tamperEntry");
  if (!auth.ok) {
    await logRefusal(actor, "tamperEntry", auth.reason);
    throw new Forbidden(auth.reason);
  }
  const rows = await getDemoDb()
    .update(ledgerEntries)
    .set({
      payload: sql`${ledgerEntries.payload} || '{"tampered":true}'::jsonb`,
    })
    .where(eq(ledgerEntries.seq, parsed.data.seq))
    .returning({ seq: ledgerEntries.seq });
  if (rows.length === 0) throw new NotFound();
  return { seq: parsed.data.seq };
}
