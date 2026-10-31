import "server-only";
import { asc } from "drizzle-orm";
import { isoToHours } from "@/domain/demo-time";
import type { LedgerView } from "@/domain/plain-event";
import { db, type DbClient } from "../db/client";
import { ledgerEntries } from "../db/schema";

type Payload = { caseId?: unknown; detail?: unknown };

/** Every ledger entry in seq order, shaped like the mockup's S.ledger. GENESIS is left out. */
export async function listLedger(client: DbClient = db): Promise<LedgerView[]> {
  const rows = await client
    .select()
    .from(ledgerEntries)
    .orderBy(asc(ledgerEntries.seq));
  return rows
    .filter((r) => r.eventType !== "GENESIS")
    .map((r) => {
      const p = (r.payload ?? {}) as Payload;
      return {
        seq: r.seq,
        t: isoToHours(r.tsIso),
        actor: r.actorId ?? "System",
        action: r.eventType,
        caseId: typeof p.caseId === "string" ? p.caseId : "",
        detail: typeof p.detail === "string" ? p.detail : "",
        hash: r.hash,
      };
    });
}
