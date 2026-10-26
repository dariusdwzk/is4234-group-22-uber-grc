import type { EventKind } from "@/domain/types";

export const REPLAY_KEY = "REPLAY-2016";

type IngestPreset = {
  type: "ingest";
  label: string;
  kind: EventKind;
  correlationKey: string;
  payload: Record<string, unknown>;
};
type DeclarePreset = {
  type: "declare";
  label: string;
  description: string;
  relatedReference: string;
};

// All synthetic. The 57M figure is the publicly reported scale: cite it in the report or swap it
// for a round synthetic number; there are never real records.
export const REPLAY_PRESETS = {
  declaration: {
    type: "declare",
    label: "1. Employee declares out-of-band demand (runs as seeded EMP)",
    description:
      "External party emailed a security lead's personal address claiming to hold rider/driver data and demanding payment.",
    relatedReference: REPLAY_KEY,
  },
  cloudDownloadAlert: {
    type: "ingest",
    label: "2. Cloud download alert",
    kind: "cloud_download_alert",
    correlationKey: REPLAY_KEY,
    payload: {
      resource: "s3://synthetic-backup-bucket",
      records: 57_000_000,
      containsPersonalData: true,
      affectedJurisdictions: ["US", "EU", "SG"],
    },
  },
  bountyReport: {
    type: "ingest",
    label: "3. Bug bounty report",
    kind: "bounty_report",
    correlationKey: REPLAY_KEY,
    payload: {
      reporterHandle: "anon-reporter-01",
      amountCents: 10_000_000,
      payeeVerified: false,
      label: "bug bounty",
      text: "We hold the data. pay us or we will go public.",
    },
  },
  paymentRequest: {
    type: "ingest",
    label: "4. Payment request",
    kind: "payment_request",
    correlationKey: REPLAY_KEY,
    payload: {
      amountCents: 10_000_000,
      payee: "anon-reporter-01",
      payeeVerified: false,
      label: "bug bounty",
      linkedToIncident: true,
    },
  },
  regulatorInquiry: {
    type: "ingest",
    label: "5. Regulator inquiry",
    kind: "regulator_inquiry",
    correlationKey: REPLAY_KEY,
    payload: { regulator: "FTC", open: true },
  },
  lowRiskLogin: {
    type: "ingest",
    label: "Scenario C: low-risk blocked login",
    kind: "blocked_login",
    correlationKey: "LOW-1",
    payload: { account: "svc-batch-01" },
  },
} as const satisfies Record<string, IngestPreset | DeclarePreset>;

export type PresetName = keyof typeof REPLAY_PRESETS;
