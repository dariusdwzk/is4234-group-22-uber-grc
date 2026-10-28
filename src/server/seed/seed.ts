import "server-only";
import { hoursToIso } from "@/domain/demo-time";
import { defaultFacts, type Facts } from "@/domain/types";
import type { Tx } from "../db/client";
import { cases, payments, settings, signals } from "../db/schema";
import { anchorHead } from "../ledger/anchor";
import { writeGenesis } from "../ledger/genesis";
import { logFor } from "../run-command";

// Copied from seed() in docs/mockup/disclosure-gate-flow.html. Synthetic data only.
const LOW_CASES: {
  id: string;
  title: string;
  h: number;
  facts?: Partial<Facts>;
}[] = [
  { id: "C-101", title: "Blocked login attempts", h: -50 },
  {
    id: "C-102",
    title: "Bug bounty: cross-site scripting",
    h: -30,
    facts: { paymentCents: 300_000, payeeVerified: true },
  },
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
    id: "SIG-103",
    source: "Finance",
    detectedH: -28,
    title: "US$3,000 to verified researcher",
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

/** Low-risk history before Day 0, its ledger entries and the first daily anchor. */
export async function seed(tx: Tx): Promise<void> {
  await tx
    .insert(settings)
    .values({ id: 1, clockH: 0, regulatorInquiryOpen: true });
  await writeGenesis(tx, hoursToIso(-50));

  await tx.insert(cases).values(
    LOW_CASES.map((c) => ({
      id: c.id,
      title: c.title,
      severity: "LOW" as const,
      status: "Logged",
      detectedH: c.h,
      facts: { ...defaultFacts(), ...c.facts },
    })),
  );
  await tx
    .insert(signals)
    .values(
      SIGNALS.map((s) => ({ ...s, origin: "system" as const, facts: {} })),
    );
  await tx.insert(payments).values({
    id: "PAY-1",
    caseId: "C-102",
    payee: "researcher-ak (verified)",
    amountCents: 300_000,
    status: "Released",
    createdH: -27,
  });

  const log = logFor(tx, { role: null, name: "System" }, 0);
  const low = (caseId: string, t: number) =>
    log(
      "Classified LOW",
      caseId,
      "No high-risk rule fired. Logged without approval.",
      { t },
    );
  await log("Signal received", "C-101", "SIG-101", {
    actor: "Cloud monitoring",
    t: -50,
  });
  await low("C-101", -50);
  await log("Signal received", "C-102", "SIG-102", {
    actor: "HackerOne",
    t: -30,
  });
  await log("Signal received", "C-102", "SIG-103", {
    actor: "Finance",
    t: -28,
  });
  await low("C-102", -28);
  await log(
    "Payment released",
    "C-102",
    "US$3,000 to verified researcher. Low-risk case, no hold.",
    { actor: "Finance", t: -27 },
  );
  await log("Signal received", "C-103", "SIG-104", {
    actor: "Secret scanning",
    t: -20,
  });
  await low("C-103", -20);
  await anchorHead(tx, 0, "Daily export");
}
