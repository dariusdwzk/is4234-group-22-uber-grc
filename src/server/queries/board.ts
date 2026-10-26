import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { computeClocks, type ClockState } from "@/domain/clocks";
import { UBER_2016, daysToBoard } from "@/domain/kpi";
import { loadRulePack } from "@/domain/rule-pack";
import type { Actor } from "@/domain/types";
import { authorize } from "../authz";
import { getNow } from "../clock";
import { db } from "../db/client";
import {
  boardItems,
  cases,
  challengeFlags,
  headExports,
  ledgerEntries,
  users,
} from "../db/schema";
import { Forbidden } from "../errors";
import { verifyChain, type ChainVerification } from "../ledger/verify";
import { logRefusal } from "../run-command";

export type BoardView = {
  cases: {
    id: string;
    ref: string;
    status: string;
    detectedAt: string;
    tier1At: string | null;
    daysToBoard: number | null;
    clocks: ClockState[];
  }[];
  tier1: { id: string; caseId: string; ref: string; body: string; at: string | null }[];
  tier2: {
    id: string;
    caseId: string;
    ref: string;
    body: string;
    status: "open" | "acknowledged";
    ackNote: string | null;
  }[];
  flags: { id: string; ref: string; text: string; raisedBy: string }[];
  unmatchedFlags: { ts: string; text: string }[];
  lastExport: { seq: number; hash: string; exportedAt: string } | null;
  verify: ChainVerification;
  kpiBaseline: typeof UBER_2016;
};

export async function getBoard(actor: Actor | null): Promise<BoardView> {
  const auth = authorize(actor, "viewBoard");
  if (!auth.ok) {
    await logRefusal(actor, "viewBoard", auth.reason);
    throw new Forbidden(auth.reason);
  }
  const now = await getNow(db);
  const pack = loadRulePack("v1");
  const caseRows = await db
    .select()
    .from(cases)
    .where(eq(cases.tier, "HIGH"))
    .orderBy(cases.ref);
  const items = await db
    .select({ b: boardItems, ref: cases.ref, highSince: cases.highSince })
    .from(boardItems)
    .innerJoin(cases, eq(cases.id, boardItems.caseId))
    .orderBy(desc(cases.ref), boardItems.id);
  const flagRows = await db
    .select({ f: challengeFlags, ref: cases.ref, name: users.displayName })
    .from(challengeFlags)
    .innerJoin(cases, eq(cases.id, challengeFlags.caseId))
    .innerJoin(users, eq(users.id, challengeFlags.raisedBy))
    .where(eq(challengeFlags.status, "open"));
  const unmatched = await db
    .select({ ts: ledgerEntries.tsIso, payload: ledgerEntries.payload })
    .from(ledgerEntries)
    .where(
      sql`${ledgerEntries.eventType} = 'FLAG_RAISED' and ${ledgerEntries.payload}->>'matched' = 'false'`,
    )
    .orderBy(desc(ledgerEntries.seq));
  const [last] = await db
    .select()
    .from(headExports)
    .orderBy(desc(headExports.id))
    .limit(1);

  return {
    cases: caseRows.map((c) => ({
      id: c.id,
      ref: c.ref,
      status: c.status,
      detectedAt: c.detectedAt.toISOString(),
      // Tier 1 is created in the transaction that sets high_since (board_items has no timestamp).
      tier1At: c.highSince?.toISOString() ?? null,
      daysToBoard: c.highSince
        ? daysToBoard(c.detectedAt.toISOString(), c.highSince.toISOString())
        : null,
      clocks: computeClocks(
        {
          detectedAt: c.detectedAt.toISOString(),
          highSince: c.highSince?.toISOString() ?? null,
          materialityDeterminedAt:
            c.materialityDeterminedAt?.toISOString() ?? null,
          closedAt: c.closedAt?.toISOString() ?? null,
          tier: c.tier,
        },
        pack,
        now,
      ),
    })),
    tier1: items
      .filter(({ b }) => b.tier === 1)
      .map(({ b, ref, highSince }) => ({
        id: b.id,
        caseId: b.caseId,
        ref,
        body: b.body,
        at: highSince?.toISOString() ?? null,
      })),
    tier2: items
      .filter(({ b }) => b.tier === 2)
      .map(({ b, ref }) => ({
        id: b.id,
        caseId: b.caseId,
        ref,
        body: b.body,
        status: b.status,
        ackNote: b.ackNote,
      }))
      // Open items stay on top until handled.
      .sort((a, b) => Number(b.status === "open") - Number(a.status === "open")),
    flags: flagRows.map(({ f, ref, name }) => ({
      id: f.id,
      ref,
      text: f.text,
      raisedBy: name,
    })),
    unmatchedFlags: unmatched.map((u) => ({
      ts: u.ts,
      text: String((u.payload as { text?: unknown }).text ?? ""),
    })),
    lastExport: last
      ? {
          seq: last.seq,
          hash: last.hash,
          exportedAt: last.exportedAt.toISOString(),
        }
      : null,
    verify: await verifyChain(),
    kpiBaseline: UBER_2016,
  };
}
