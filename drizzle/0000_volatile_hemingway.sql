CREATE TABLE "approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"role" text NOT NULL,
	"vote" text NOT NULL,
	"reason" text NOT NULL,
	"created_h" integer NOT NULL,
	CONSTRAINT "approvals_case_role_uq" UNIQUE("case_id","role")
);
--> statement-breakpoint
CREATE TABLE "board_notices" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"tier" integer NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"created_h" integer NOT NULL,
	"ack_h" integer,
	"all_directors" boolean DEFAULT false NOT NULL,
	CONSTRAINT "board_notices_case_kind_uq" UNIQUE("case_id","kind")
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"severity" text NOT NULL,
	"status" text NOT NULL,
	"detected_h" integer NOT NULL,
	"facts" jsonb NOT NULL,
	"clocks_start_h" integer,
	"finding" text,
	"disclosed_h" integer
);
--> statement-breakpoint
CREATE TABLE "challenge_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"text" text NOT NULL,
	"anonymous" boolean NOT NULL,
	"open" boolean DEFAULT true NOT NULL,
	"created_h" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"case_id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"need" integer NOT NULL,
	"disclose" boolean NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"created_h" integer NOT NULL,
	"resolved_h" integer
);
--> statement-breakpoint
CREATE TABLE "external_anchors" (
	"id" serial PRIMARY KEY NOT NULL,
	"seq" bigint NOT NULL,
	"head_hash" char(64) NOT NULL,
	"created_h" integer NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"seq" bigint PRIMARY KEY NOT NULL,
	"ts_iso" text NOT NULL,
	"actor_id" text,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"prev_hash" char(64) NOT NULL,
	"hash" char(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_head" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"seq" bigint NOT NULL,
	"hash" char(64) NOT NULL,
	CONSTRAINT "ledger_head_single_row" CHECK ("ledger_head"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"payee" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"status" text NOT NULL,
	"created_h" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"code" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"signal_id" text,
	"case_id" text,
	"flag_id" text
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"case_id" text PRIMARY KEY NOT NULL,
	"author_role" text NOT NULL,
	"action" text NOT NULL,
	"claims" jsonb NOT NULL,
	"created_h" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"clock_h" integer DEFAULT 0 NOT NULL,
	"regulator_inquiry_open" boolean DEFAULT true NOT NULL,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"origin" text NOT NULL,
	"detected_h" integer NOT NULL,
	"title" text NOT NULL,
	"entity_keys" text[] NOT NULL,
	"facts" jsonb NOT NULL,
	"case_id" text,
	"anonymous" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_case_id_decisions_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."decisions"("case_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_notices" ADD CONSTRAINT "board_notices_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_flags" ADD CONSTRAINT "challenge_flags_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_flag_id_challenge_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."challenge_flags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;