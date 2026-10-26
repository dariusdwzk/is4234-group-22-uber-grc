import "server-only";
import { count, desc, sql } from "drizzle-orm";
import type { Actor } from "@/domain/types";
import { authorize } from "../authz";
import { db } from "../db/client";
import { ledgerEntries, users } from "../db/schema";
import { Forbidden } from "../errors";
import { logRefusal } from "../run-command";

const PAGE_SIZE = 50;

export type LedgerRowView = {
  seq: number;
  ts: string;
  actorName: string;
  eventType: string;
  hashShort: string;
  payloadPreview: string;
};

export async function listLedger(
  actor: Actor | null,
  { page }: { page: number },
): Promise<{ rows: LedgerRowView[]; total: number; pageSize: number }> {
  const auth = authorize(actor, "viewLedger");
  if (!auth.ok) {
    await logRefusal(actor, "viewLedger", auth.reason);
    throw new Forbidden(auth.reason);
  }
  const p = Number.isInteger(page) && page >= 1 ? page : 1;
  const rows = await db
    .select({ e: ledgerEntries, name: users.displayName })
    .from(ledgerEntries)
    // actor_id is text (the system actor is not a user row), so compare as text.
    .leftJoin(users, sql`${ledgerEntries.actorId} = ${users.id}::text`)
    .orderBy(desc(ledgerEntries.seq))
    .limit(PAGE_SIZE)
    .offset((p - 1) * PAGE_SIZE);
  const [{ n }] = (await db.select({ n: count() }).from(ledgerEntries)) as [
    { n: number },
  ];
  return {
    total: n,
    pageSize: PAGE_SIZE,
    rows: rows.map(({ e, name }) => ({
      seq: e.seq,
      ts: e.tsIso,
      actorName: name ?? (e.actorId === "system" ? "System" : "—"),
      eventType: e.eventType,
      hashShort: e.hash.slice(0, 12),
      payloadPreview: JSON.stringify(e.payload).slice(0, 120),
    })),
  };
}
