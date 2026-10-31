import "server-only";
import { hoursToIso } from "@/domain/demo-time";
import { SYSTEM_ACTOR, defaultFacts, type Facts } from "@/domain/types";
import { ingest, insertSignal } from "../cases/engine";
import { wallNow } from "../clock";
import type { Tx } from "../db/client";
import { cases, settings, signals } from "../db/schema";
import { anchorHead } from "../ledger/anchor";
import { writeGenesis } from "../ledger/genesis";
import { logFor, type CommandCtx } from "../run-command";

// Copied from seed() in docs/mockup/disclosure-gate-flow.html. Synthetic data only.
// Times are made up: hours before the reset, so the story always ends "now".
const LOW_CASES: {
  id: string;
  title: string;
  h: number;
  facts?: Partial<Facts>;
}[] = [
  { id: "C-101", title: "Blocked login attempts", h: -50 },
  { id: "C-102", title: "Cross-site scripting report", h: -30 },
  { id: "C-103", title: "AWS key in public repository", h: -20 },
];

const SIGNALS = [
  {
    id: "SIG-101",
    source: "Cloud monitoring",
    detectedH: -50,
    title: "Blocked login attempts on driver portal",
    entityKeys: ["driver-portal"],
    caseId: "C-101",
  },
  {
    id: "SIG-102",
    source: "HackerOne",
    detectedH: -30,
    title: "Cross-site scripting report, verified researcher",
    entityKeys: ["researcher-ak"],
    caseId: "C-102",
  },
  {
    id: "SIG-104",
    source: "Secret scanning",
    detectedH: -20,
    title: "AWS key found in public repository",
    entityKeys: ["aws-key-7q2"],
    caseId: "C-103",
  },
];

/** Low-risk history before Day 0, the daily anchor, then Day 0 (now): the mass download opens C-104. */
export async function seed(tx: Tx): Promise<void> {
  const t0 = wallNow();
  await tx
    .insert(settings)
    .values({ id: 1, clockH: 0, regulatorInquiryOpen: true });
  await writeGenesis(tx, hoursToIso(t0 - 50));

  await tx.insert(cases).values(
    LOW_CASES.map((c) => ({
      id: c.id,
      title: c.title,
      severity: "LOW" as const,
      status: "Logged",
      detectedH: t0 + c.h,
      facts: { ...defaultFacts(), ...c.facts },
    })),
  );
  await tx.insert(signals).values(
    SIGNALS.map((s) => ({
      ...s,
      detectedH: t0 + s.detectedH,
      origin: "system" as const,
      facts: {},
    })),
  );

  const log = logFor(tx, { role: null, name: "System" }, t0);
  const low = (caseId: string, t: number) =>
    log(
      "Classified LOW",
      caseId,
      "No high-risk rule fired. Logged without approval.",
      { t: t0 + t },
    );
  await log("Signal received", "C-101", "SIG-101", {
    actor: "Cloud monitoring",
    t: t0 - 50,
  });
  await low("C-101", -50);
  await log("Signal received", "C-102", "SIG-102", {
    actor: "HackerOne",
    t: t0 - 30,
  });
  await low("C-102", -30);
  await log("Signal received", "C-103", "SIG-104", {
    actor: "Secret scanning",
    t: t0 - 20,
  });
  await low("C-103", -20);
  await anchorHead(tx, t0, "Daily export");

  // Day 0: cloud monitoring flags the mass download. The case opens by itself.
  const ctx: CommandCtx = { tx, actor: SYSTEM_ACTOR, now: t0, log };
  const sig = await insertSignal(tx, {
    source: "Cloud monitoring",
    origin: "system",
    detectedH: t0,
    title: "16 objects downloaded from rider-backup by an unknown IP",
    entityKeys: ["rider-backup"],
    facts: {
      dataAccessed: true,
      objects: 16,
      records: "57 million",
      licences: "600,000",
      jurisdictions: ["EU", "California", "Singapore"],
    },
  });
  await log("Signal received", null, sig + ": mass download", {
    actor: "Cloud monitoring",
  });
  await ingest(ctx, sig, "Mass download of rider and driver data");
}
