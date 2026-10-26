import {
  bigint,
  char,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type {
  CaseStatus,
  EventKind,
  JsonValue,
  Outcome,
  Role,
  Tier,
} from "@/domain/types";

const tstz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").$type<Role>().notNull(),
  reportsTo: uuid("reports_to").references((): AnyPgColumn => users.id),
  passwordHash: text("password_hash").notNull(),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: tstz("locked_until"),
});

export const sessions = pgTable("sessions", {
  tokenSha256: char("token_sha256", { length: 64 }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: tstz("expires_at").notNull(),
});

export const cases = pgTable(
  "cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ref: text("ref").notNull().unique(),
    correlationKey: text("correlation_key").notNull(),
    source: text("source").$type<"manual" | "simulator">().notNull(),
    tier: text("tier").$type<Tier>().notNull().default("LOW"),
    status: text("status").$type<CaseStatus>().notNull().default("open"),
    detectedAt: tstz("detected_at").notNull(),
    highSince: tstz("high_since"),
    materialityDeterminedAt: tstz("materiality_determined_at"),
    declaredBy: uuid("declared_by").references(() => users.id),
    outcome: text("outcome").$type<Outcome>(),
    notifyBy: tstz("notify_by"),
    closedAt: tstz("closed_at"),
  },
  (t) => [index("cases_correlation_key_idx").on(t.correlationKey)],
);

export const intakeEvents = pgTable("intake_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => cases.id),
  kind: text("kind").$type<EventKind>().notNull(),
  occurredAt: tstz("occurred_at").notNull(),
  payload: jsonb("payload").$type<JsonValue>().notNull(),
});

export const ruleEvaluations = pgTable("rule_evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => cases.id),
  rulePackVersion: text("rule_pack_version").notNull(),
  firedRuleIds: text("fired_rule_ids").array().notNull(),
  tier: text("tier").$type<Tier>().notNull(),
  evaluatedAt: tstz("evaluated_at").notNull(),
});

export const recommendations = pgTable("recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => cases.id),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  proposedOutcome: text("proposed_outcome").$type<Outcome>().notNull(),
  dataTaken: text("data_taken").$type<"yes" | "no" | "unknown">().notNull(),
  treatAs: text("treat_as").$type<"incident" | "bug_bounty">().notNull(),
  text: text("text").notNull(),
});

export const decisions = pgTable(
  "decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    approverId: uuid("approver_id")
      .notNull()
      .references(() => users.id),
    approverRole: text("approver_role").$type<Role>().notNull(),
    outcome: text("outcome").$type<Outcome>().notNull(),
    notifyBy: tstz("notify_by"),
    reasonCode: text("reason_code").notNull(),
    checklist: jsonb("checklist").$type<JsonValue>().notNull(),
  },
  (t) => [unique("decisions_case_role_uq").on(t.caseId, t.approverRole)],
);

export const boardItems = pgTable(
  "board_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    tier: integer("tier").$type<1 | 2>().notNull(),
    reasonKey: text("reason_key").notNull(),
    body: text("body").notNull(),
    status: text("status")
      .$type<"open" | "acknowledged">()
      .notNull()
      .default("open"),
    ackNote: text("ack_note"),
    ackBy: uuid("ack_by").references(() => users.id),
    ackAt: tstz("ack_at"),
  },
  // Exactly-once escalation (US-19) is enforced by the database, not by callers.
  (t) => [unique("board_items_case_reason_uq").on(t.caseId, t.reasonKey)],
);

export const challengeFlags = pgTable("challenge_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => cases.id),
  raisedBy: uuid("raised_by")
    .notNull()
    .references(() => users.id),
  text: text("text").notNull(),
  status: text("status").$type<"open" | "resolved">().notNull().default("open"),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolution: text("resolution"),
});

export const rulePacks = pgTable("rule_packs", {
  version: text("version").primaryKey(),
  body: jsonb("body").$type<JsonValue>().notNull(),
  publishedBy: uuid("published_by").references(() => users.id),
  publishedAt: tstz("published_at").notNull(),
});

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

export const headExports = pgTable("head_exports", {
  id: serial("id").primaryKey(),
  seq: bigint("seq", { mode: "number" }).notNull(),
  hash: char("hash", { length: 64 }).notNull(),
  entryCount: integer("entry_count").notNull(),
  exportedAt: tstz("exported_at").notNull(),
  destination: text("destination").notNull().default("simulated_auditor_inbox"),
});

export const demoSettings = pgTable(
  "demo_settings",
  {
    id: integer("id").primaryKey().default(1),
    offsetMs: bigint("offset_ms", { mode: "number" }).notNull().default(0),
  },
  (t) => [check("demo_settings_single_row", sql`${t.id} = 1`)],
);
