import {
  bigint,
  boolean,
  char,
  check,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Answers, Route } from "@/domain/questionnaire";
import type {
  Facts,
  JsonValue,
  PaymentStatus,
  RoleKey,
  Severity,
  SignalOrigin,
} from "@/domain/types";

// Every *_h column is whole hours relative to Day 0 (src/domain/demo-time.ts).

export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    clockH: integer("clock_h").notNull().default(0),
    regulatorInquiryOpen: boolean("regulator_inquiry_open")
      .notNull()
      .default(true),
  },
  (t) => [check("settings_single_row", sql`${t.id} = 1`)],
);

export const cases = pgTable("cases", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  severity: text("severity").$type<Severity>().notNull(),
  status: text("status").notNull(),
  detectedH: integer("detected_h").notNull(),
  facts: jsonb("facts").$type<Facts>().notNull(),
  clocksStartH: integer("clocks_start_h"),
  finding: text("finding"),
  disclosedH: integer("disclosed_h"),
  // Staff reports (src/domain/questionnaire.ts). System cases keep the defaults.
  route: text("route").$type<Route>().notNull().default("NORMAL"),
  questionnaireAnswers: jsonb("questionnaire_answers").$type<Answers>(),
  /** Unrated at this hour: rated HIGH automatically. */
  triageDueH: integer("triage_due_h"),
  /** LOW staff report not reviewed by Security at this hour: the board is told. */
  reviewDueH: integer("review_due_h"),
});

export const signals = pgTable("signals", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  origin: text("origin").$type<SignalOrigin>().notNull(),
  detectedH: integer("detected_h").notNull(),
  title: text("title").notNull(),
  entityKeys: text("entity_keys").array().notNull(),
  facts: jsonb("facts").$type<Partial<Facts>>().notNull(),
  caseId: text("case_id").references(() => cases.id),
  anonymous: boolean("anonymous").notNull().default(false),
});

export const recommendations = pgTable("recommendations", {
  caseId: text("case_id")
    .primaryKey()
    .references(() => cases.id),
  authorRole: text("author_role").$type<RoleKey>().notNull(),
  action: text("action").$type<"limit" | "disclose">().notNull(),
  claims: jsonb("claims")
    .$type<{ noData: boolean; verified: boolean; routine: boolean }>()
    .notNull(),
  createdH: integer("created_h").notNull(),
});

export const decisions = pgTable("decisions", {
  caseId: text("case_id")
    .primaryKey()
    .references(() => cases.id),
  type: text("type").notNull(),
  need: integer("need").notNull(),
  disclose: boolean("disclose").notNull(),
  status: text("status")
    .$type<"Pending" | "Approved" | "Rejected">()
    .notNull()
    .default("Pending"),
  createdH: integer("created_h").notNull(),
  resolvedH: integer("resolved_h"),
});

export const approvals = pgTable(
  "approvals",
  {
    id: serial("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => decisions.caseId),
    role: text("role").$type<"gc" | "cpo">().notNull(),
    vote: text("vote").$type<"approve" | "reject">().notNull(),
    reason: text("reason").notNull(),
    createdH: integer("created_h").notNull(),
  },
  // One vote per person, enforced by the database.
  (t) => [unique("approvals_case_role_uq").on(t.caseId, t.role)],
);

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  caseId: text("case_id")
    .notNull()
    .references(() => cases.id),
  payee: text("payee").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  status: text("status").$type<PaymentStatus>().notNull(),
  createdH: integer("created_h").notNull(),
});

export const challengeFlags = pgTable("challenge_flags", {
  id: text("id").primaryKey(),
  caseId: text("case_id")
    .notNull()
    .references(() => cases.id),
  text: text("text").notNull(),
  anonymous: boolean("anonymous").notNull(),
  open: boolean("open").notNull().default(true),
  createdH: integer("created_h").notNull(),
});

export const receipts = pgTable("receipts", {
  code: text("code").primaryKey(),
  kind: text("kind").$type<"report" | "challenge">().notNull(),
  signalId: text("signal_id").references(() => signals.id),
  caseId: text("case_id").references(() => cases.id),
  flagId: text("flag_id").references(() => challengeFlags.id),
});

// No update/delete path for body: notices are generated text and only ack fields change.
export const boardNotices = pgTable(
  "board_notices",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id),
    tier: integer("tier").$type<1 | 2>().notNull(),
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    createdH: integer("created_h").notNull(),
    ackH: integer("ack_h"),
    allDirectors: boolean("all_directors").notNull().default(false),
  },
  // Each escalation fires once per case, enforced by the database.
  (t) => [unique("board_notices_case_kind_uq").on(t.caseId, t.kind)],
);

// ts_iso is text, not timestamptz: it is hashed byte for byte and a timestamptz
// round trip would change microsecond precision (spec §5).
export const ledgerEntries = pgTable("ledger_entries", {
  seq: bigint("seq", { mode: "number" }).primaryKey(),
  tsIso: text("ts_iso").notNull(),
  actorId: text("actor_id"),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").$type<JsonValue>().notNull(),
  prevHash: char("prev_hash", { length: 64 }).notNull(),
  hash: char("hash", { length: 64 }).notNull(),
});

export const ledgerHead = pgTable(
  "ledger_head",
  {
    id: integer("id").primaryKey().default(1),
    seq: bigint("seq", { mode: "number" }).notNull(),
    hash: char("hash", { length: 64 }).notNull(),
  },
  (t) => [check("ledger_head_single_row", sql`${t.id} = 1`)],
);

/** Copies of (seq, head hash) held "outside" the app, compared by the integrity check. */
export const externalAnchors = pgTable("external_anchors", {
  id: serial("id").primaryKey(),
  seq: bigint("seq", { mode: "number" }).notNull(),
  headHash: char("head_hash", { length: 64 }).notNull(),
  createdH: integer("created_h").notNull(),
  reason: text("reason").notNull(),
});
