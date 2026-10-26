CREATE TABLE "board_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"tier" integer NOT NULL,
	"reason_key" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"ack_note" text,
	"ack_by" uuid,
	"ack_at" timestamp with time zone,
	CONSTRAINT "board_items_case_reason_uq" UNIQUE("case_id","reason_key")
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"correlation_key" text NOT NULL,
	"source" text NOT NULL,
	"tier" text DEFAULT 'LOW' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	"high_since" timestamp with time zone,
	"materiality_determined_at" timestamp with time zone,
	"declared_by" uuid,
	"outcome" text,
	"notify_by" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "cases_ref_unique" UNIQUE("ref")
);
--> statement-breakpoint
CREATE TABLE "challenge_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"raised_by" uuid NOT NULL,
	"text" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolution" text
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"approver_id" uuid NOT NULL,
	"approver_role" text NOT NULL,
	"outcome" text NOT NULL,
	"notify_by" timestamp with time zone,
	"reason_code" text NOT NULL,
	"checklist" jsonb NOT NULL,
	CONSTRAINT "decisions_case_role_uq" UNIQUE("case_id","approver_role")
);
--> statement-breakpoint
CREATE TABLE "demo_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"offset_ms" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "demo_settings_single_row" CHECK ("demo_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "head_exports" (
	"id" serial PRIMARY KEY NOT NULL,
	"seq" bigint NOT NULL,
	"hash" char(64) NOT NULL,
	"entry_count" integer NOT NULL,
	"exported_at" timestamp with time zone NOT NULL,
	"destination" text DEFAULT 'simulated_auditor_inbox' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL
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
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"proposed_outcome" text NOT NULL,
	"data_taken" text NOT NULL,
	"treat_as" text NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"rule_pack_version" text NOT NULL,
	"fired_rule_ids" text[] NOT NULL,
	"tier" text NOT NULL,
	"evaluated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_packs" (
	"version" text PRIMARY KEY NOT NULL,
	"body" jsonb NOT NULL,
	"published_by" uuid,
	"published_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_sha256" char(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"reports_to" uuid,
	"password_hash" text NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "board_items" ADD CONSTRAINT "board_items_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_items" ADD CONSTRAINT "board_items_ack_by_users_id_fk" FOREIGN KEY ("ack_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_declared_by_users_id_fk" FOREIGN KEY ("declared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_flags" ADD CONSTRAINT "challenge_flags_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_flags" ADD CONSTRAINT "challenge_flags_raised_by_users_id_fk" FOREIGN KEY ("raised_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_flags" ADD CONSTRAINT "challenge_flags_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_events" ADD CONSTRAINT "intake_events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_evaluations" ADD CONSTRAINT "rule_evaluations_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_packs" ADD CONSTRAINT "rule_packs_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_reports_to_users_id_fk" FOREIGN KEY ("reports_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cases_correlation_key_idx" ON "cases" USING btree ("correlation_key");