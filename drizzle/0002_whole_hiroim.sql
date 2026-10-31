ALTER TABLE "cases" ADD COLUMN "route" text DEFAULT 'NORMAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "questionnaire_answers" jsonb;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "triage_due_h" integer;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "review_due_h" integer;