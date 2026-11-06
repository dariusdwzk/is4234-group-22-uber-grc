ALTER TABLE "challenge_flags" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "challenge_flags" CASCADE;--> statement-breakpoint
ALTER TABLE "receipts" DROP CONSTRAINT "receipts_signal_id_signals_id_fk";
--> statement-breakpoint
ALTER TABLE "receipts" DROP CONSTRAINT IF EXISTS "receipts_flag_id_challenge_flags_id_fk";

--> statement-breakpoint
ALTER TABLE "receipts" ALTER COLUMN "case_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "receipts" DROP COLUMN "signal_id";--> statement-breakpoint
ALTER TABLE "receipts" DROP COLUMN "flag_id";