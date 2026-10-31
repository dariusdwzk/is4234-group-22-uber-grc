ALTER TABLE "payments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "payments" CASCADE;--> statement-breakpoint
ALTER TABLE "approvals" ALTER COLUMN "created_h" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "board_notices" ALTER COLUMN "created_h" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "board_notices" ALTER COLUMN "ack_h" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "cases" ALTER COLUMN "detected_h" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "cases" ALTER COLUMN "clocks_start_h" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "cases" ALTER COLUMN "disclosed_h" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "cases" ALTER COLUMN "triage_due_h" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "cases" ALTER COLUMN "review_due_h" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "decisions" ALTER COLUMN "created_h" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "decisions" ALTER COLUMN "resolved_h" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "evidence" ALTER COLUMN "created_h" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "external_anchors" ALTER COLUMN "created_h" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "recommendations" ALTER COLUMN "created_h" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "clock_h" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "signals" ALTER COLUMN "detected_h" SET DATA TYPE double precision;